#import <Cocoa/Cocoa.h>
#import <QuartzCore/QuartzCore.h>   // CACurrentMediaTime

#include "renderer/RendererFactory.h"
#include "renderer/IRenderer.h"
#include "renderer/ICommandBuffer.h"
#include "world/world.hpp"          // World::SIZE — needed for the loading overlay progress bar
#include "constants/controls.hpp"   // Controls::kQuit
#include "game.hpp"

// ---------------------------------------------------------------------------
@interface AppDelegate : NSObject<NSApplicationDelegate, NSWindowDelegate> {
    NSWindow*                  _window;
    std::unique_ptr<IRenderer> _renderer;
    Game                       _game;
    CFTimeInterval             _lastTime;
    id                         _keyMonitorDown;
    id                         _keyMonitorUp;
    id                         _mouseMonitor;
    id                         _mouseMoveMonitor;
    uint32_t                   _width;
    uint32_t                   _height;
    BOOL                       _cursorLocked;
    // Loading overlay
    NSView*                    _loadingView;
    NSProgressIndicator*       _progressBar;
    NSTextField*               _progressLabel;
}
@end

@implementation AppDelegate

- (void)applicationDidFinishLaunching:(NSNotification*)notification
{
    // Heavy init (renderer, world, meshes) is deferred to windowDidEnterFullScreen:
    // so we have the correct post-transition content-view size.
    NSRect screen = [[NSScreen mainScreen] frame];
    _width  = static_cast<uint32_t>(screen.size.width);
    _height = static_cast<uint32_t>(screen.size.height);

    NSWindowStyleMask style = NSWindowStyleMaskTitled
                            | NSWindowStyleMaskClosable
                            | NSWindowStyleMaskMiniaturizable
                            | NSWindowStyleMaskResizable;
    _window = [[NSWindow alloc]
        initWithContentRect:screen
        styleMask:style
        backing:NSBackingStoreBuffered
        defer:NO];
    [_window setDelegate:self];
    [_window setCollectionBehavior:NSWindowCollectionBehaviorFullScreenPrimary];
    [_window makeKeyAndOrderFront:nil];
    [_window toggleFullScreen:nil];
}

- (void)windowDidEnterFullScreen:(NSNotification*)notification
{
    NSRect bounds = [[_window contentView] bounds];
    _width  = static_cast<uint32_t>(bounds.size.width);
    _height = static_cast<uint32_t>(bounds.size.height);

    // --- Renderer (platform-specific creation, abstract interface from here on) ---
    NSView* view = [_window contentView];
    _renderer = RendererFactory::create();
    if (!_renderer->init((__bridge void*)view, _width, _height)) {
        NSLog(@"[main] Renderer init failed");
        [NSApp terminate:nil];
        return;
    }

    // --- Game ---
    _game.init(*_renderer, _width, _height);

    // --- Event monitors ---
    __weak AppDelegate* weakSelf = self;

    _keyMonitorDown = [NSEvent
        addLocalMonitorForEventsMatchingMask:NSEventMaskKeyDown
        handler:^NSEvent*(NSEvent* e) {
            AppDelegate* s = weakSelf;
            if (!s) return nil;
            if (e.keyCode == Controls::kQuit) {
                [s unlockCursor];
                [NSApp terminate:nil];
                return nil;
            }
            s->_game.keyDown((uint16_t)e.keyCode);
            return nil;  // consume: prevents NSBeep() on unhandled key repeat
        }];

    _keyMonitorUp = [NSEvent
        addLocalMonitorForEventsMatchingMask:NSEventMaskKeyUp
        handler:^NSEvent*(NSEvent* e) {
            AppDelegate* s = weakSelf;
            if (s) s->_game.keyUp((uint16_t)e.keyCode);
            return nil;
        }];

    _mouseMonitor = [NSEvent
        addLocalMonitorForEventsMatchingMask:NSEventMaskLeftMouseDown
        handler:^NSEvent*(NSEvent* e) {
            [weakSelf lockCursor];
            return e;
        }];

    _mouseMoveMonitor = [NSEvent
        addLocalMonitorForEventsMatchingMask:NSEventMaskMouseMoved | NSEventMaskLeftMouseDragged
        handler:^NSEvent*(NSEvent* e) {
            AppDelegate* s = weakSelf;
            if (s && s->_cursorLocked)
                s->_game.mouseDelta((float)e.deltaX, (float)e.deltaY);
            return e;
        }];

    [self showLoadingOverlay];
    [self startAsyncLoading];
}

// ---------------------------------------------------------------------------
// Loading overlay (macOS UI — NSView / NSProgressIndicator)
// ---------------------------------------------------------------------------

- (void)showLoadingOverlay
{
    NSView* content = [_window contentView];
    NSRect frame = content.bounds;

    _loadingView = [[NSView alloc] initWithFrame:frame];
    _loadingView.wantsLayer = YES;
    _loadingView.layer.backgroundColor =
        [[NSColor colorWithWhite:0.04 alpha:1.0] CGColor];
    _loadingView.autoresizingMask = NSViewWidthSizable | NSViewHeightSizable;

    CGFloat cx = frame.size.width  / 2.0;
    CGFloat cy = frame.size.height / 2.0;

    NSTextField* title = [NSTextField labelWithString:@"Loading World"];
    title.font      = [NSFont systemFontOfSize:26 weight:NSFontWeightSemibold];
    title.textColor = [NSColor whiteColor];
    title.alignment = NSTextAlignmentCenter;
    [title sizeToFit];
    title.frame = NSMakeRect(cx - title.frame.size.width / 2.0,
                             cy + 36,
                             title.frame.size.width,
                             title.frame.size.height);

    _progressBar = [[NSProgressIndicator alloc]
        initWithFrame:NSMakeRect(cx - 220, cy - 4, 440, 16)];
    _progressBar.style         = NSProgressIndicatorStyleBar;
    _progressBar.indeterminate = NO;
    _progressBar.minValue      = 0;
    _progressBar.maxValue      = World::SIZE * World::SIZE * World::SIZE * 2.0;
    _progressBar.doubleValue   = 0;

    constexpr uint32_t total = World::SIZE * World::SIZE * World::SIZE;
    _progressLabel = [NSTextField labelWithString:
        [NSString stringWithFormat:@"0 / %u chunks", total]];
    _progressLabel.font      = [NSFont monospacedDigitSystemFontOfSize:12
                                                               weight:NSFontWeightRegular];
    _progressLabel.textColor = [NSColor colorWithWhite:0.6 alpha:1.0];
    _progressLabel.alignment = NSTextAlignmentCenter;
    [_progressLabel sizeToFit];
    _progressLabel.frame = NSMakeRect(cx - 110, cy - 28,
                                      220, _progressLabel.frame.size.height);

    [_loadingView addSubview:title];
    [_loadingView addSubview:_progressBar];
    [_loadingView addSubview:_progressLabel];
    [content addSubview:_loadingView];
}

- (void)updateLoadingProgress:(uint32_t)done
                           of:(uint32_t)outOf
                        label:(NSString*)label
{
    _progressBar.doubleValue   = done;
    _progressLabel.stringValue = label;
}

- (void)startAsyncLoading
{
    __weak AppDelegate* weakSelf = self;
    constexpr uint32_t total = World::SIZE * World::SIZE * World::SIZE;

    dispatch_async(dispatch_get_global_queue(QOS_CLASS_USER_INITIATED, 0), ^{
        AppDelegate* s = weakSelf;
        if (!s) return;

        // Game::loadWorld is synchronous and backend-agnostic.
        // We wrap the callbacks here to marshal progress updates onto the main
        // thread for the macOS UI — no dispatch_async lives inside Game.
        s->_game.loadWorld(
            // worldProgress
            [weakSelf](uint32_t done, uint32_t t) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    NSString* lbl = [NSString stringWithFormat:
                        @"Generating terrain: %u / %u chunks", done, t];
                    [weakSelf updateLoadingProgress:done of:total * 2 label:lbl];
                });
            },
            // meshProgress
            [weakSelf](uint32_t done, uint32_t t) {
                dispatch_async(dispatch_get_main_queue(), ^{
                    NSString* lbl = [NSString stringWithFormat:
                        @"Building meshes: %u / %u chunks", done, t];
                    [weakSelf updateLoadingProgress:total + done of:total * 2 label:lbl];
                });
            }
        );

        dispatch_async(dispatch_get_main_queue(), ^{
            [weakSelf finishLoading];
        });
    });
}

- (void)finishLoading
{
    [_loadingView removeFromSuperview];
    _loadingView   = nil;
    _progressBar   = nil;
    _progressLabel = nil;

    _lastTime = CACurrentMediaTime();
    [NSTimer scheduledTimerWithTimeInterval:(1.0 / 60.0)
                                     target:self
                                   selector:@selector(tick:)
                                   userInfo:nil
                                    repeats:YES];
}

// ---------------------------------------------------------------------------
// Frame loop
// ---------------------------------------------------------------------------

- (void)tick:(NSTimer*)timer
{
    CFTimeInterval now = CACurrentMediaTime();
    float dt = static_cast<float>(now - _lastTime);
    _lastTime = now;
    if (dt > 0.1f) dt = 0.1f;  // cap: avoid spiral-of-death after a stall

    _game.update(dt);

    ICommandBuffer* cmd = _renderer->beginFrame();
    if (!cmd) return;
    _game.render(*cmd);
    _renderer->endFrame();
    _renderer->present();
}

// ---------------------------------------------------------------------------
// Window / cursor
// ---------------------------------------------------------------------------

- (void)windowDidResize:(NSNotification*)notification
{
    NSRect bounds = [[_window contentView] bounds];
    _width  = static_cast<uint32_t>(bounds.size.width);
    _height = static_cast<uint32_t>(bounds.size.height);
    if (_renderer) {
        _renderer->resize(_width, _height);
        _game.resize(_width, _height);
    }
}

- (void)lockCursor
{
    if (_cursorLocked) return;
    _cursorLocked = YES;
    [NSCursor hide];
    CGAssociateMouseAndMouseCursorPosition(NO);
}

- (void)unlockCursor
{
    if (!_cursorLocked) return;
    _cursorLocked = NO;
    CGAssociateMouseAndMouseCursorPosition(YES);
    [NSCursor unhide];
}

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

- (BOOL)applicationShouldTerminateAfterLastWindowClosed:(NSApplication*)sender
{
    return YES;
}

- (void)dealloc
{
    [self unlockCursor];
    if (_keyMonitorDown)   [NSEvent removeMonitor:_keyMonitorDown];
    if (_keyMonitorUp)     [NSEvent removeMonitor:_keyMonitorUp];
    if (_mouseMonitor)     [NSEvent removeMonitor:_mouseMonitor];
    if (_mouseMoveMonitor) [NSEvent removeMonitor:_mouseMoveMonitor];
    World::destroy();
}

@end

// ---------------------------------------------------------------------------
int main()
{
    @autoreleasepool {
        NSApplication* app = [NSApplication sharedApplication];
        [app setActivationPolicy:NSApplicationActivationPolicyRegular];
        AppDelegate* delegate = [[AppDelegate alloc] init];
        [app setDelegate:delegate];
        [app activateIgnoringOtherApps:YES];
        [app run];
    }
    return 0;
}

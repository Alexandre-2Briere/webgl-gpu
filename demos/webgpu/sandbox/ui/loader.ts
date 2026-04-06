import toolbarHtml          from './Toolbar/toolbar.html?raw'
import itemMenuHtml         from './ItemMenu/item-menu.html?raw'
import propertyPanelHtml    from './PropertyPanel/property-panel.html?raw'
import terminalHtml         from './Terminal/terminal.html?raw'
import sceneHierarchyHtml   from './SceneHierarchy/scene-hierarchy.html?raw'

export function mountComponents(): void {
  document.getElementById('toolbar')!.innerHTML          = toolbarHtml
  document.getElementById('item-menu')!.innerHTML        = itemMenuHtml
  document.getElementById('property-panel')!.innerHTML   = propertyPanelHtml
  document.getElementById('terminal-panel')!.innerHTML   = terminalHtml
  document.getElementById('scene-hierarchy')!.innerHTML  = sceneHierarchyHtml
}

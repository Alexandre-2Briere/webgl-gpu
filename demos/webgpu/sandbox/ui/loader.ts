import toolbarHtml          from './components/toolbar.html?raw'
import itemMenuHtml         from './components/item-menu.html?raw'
import propertyPanelHtml    from './components/property-panel.html?raw'
import terminalHtml         from './components/terminal.html?raw'
import sceneHierarchyHtml   from './components/scene-hierarchy.html?raw'

export function mountComponents(): void {
  document.getElementById('toolbar')!.innerHTML          = toolbarHtml
  document.getElementById('item-menu')!.innerHTML        = itemMenuHtml
  document.getElementById('property-panel')!.innerHTML   = propertyPanelHtml
  document.getElementById('terminal-panel')!.innerHTML   = terminalHtml
  document.getElementById('scene-hierarchy')!.innerHTML  = sceneHierarchyHtml
}

import { mountComponents }  from './ui/loader'
import { Terminal }          from './ui/Terminal/Terminal'
import { ItemMenu }          from './ui/ItemMenu/ItemMenu'
import { PropertyPanel }     from './ui/PropertyPanel/PropertyPanel'
import { SceneHierarchy }    from './ui/SceneHierarchy/SceneHierarchy'
import { Toolbar }           from './ui/Toolbar/Toolbar'
import { SceneManager }      from './game/SceneManager'
import registryJson          from './items/registry.json'
import type { ItemRegistry } from './items/types'

async function main(): Promise<void> {
  mountComponents()

  const registry = registryJson as ItemRegistry

  const canvas = document.getElementById('webgpu-canvas') as HTMLCanvasElement

  const terminal      = new Terminal(
    document.getElementById('terminal-tabs')!,
    document.getElementById('terminal-output')!,
  )
  const propertyPanel = new PropertyPanel(document.getElementById('property-panel')!)
  const toolbar       = new Toolbar()

  // Use a ref object so hierarchy callbacks reach the SceneManager instance
  // before it is assigned (they are passed as constructor callbacks).
  const sceneRef = { current: null as unknown as SceneManager }

  const sceneHierarchy = new SceneHierarchy(
    document.getElementById('scene-hierarchy')!,
    (index) => sceneRef.current.selectObject(index),
    (index, newName) => sceneRef.current.renameObject(index, newName),
    (index) => sceneRef.current.removeObject(index),
    () => sceneRef.current.deselectObject(),
  )

  const sceneManager = new SceneManager(canvas, terminal, propertyPanel, sceneHierarchy)
  sceneRef.current   = sceneManager

  const itemMenu = new ItemMenu(
    document.getElementById('item-menu')!,
    registry,
    (key, entry) => sceneManager.spawn(key, entry),
  )
  itemMenu.setEnabled(false)

  try {
    await sceneManager.init()
    sceneManager.startLoop()
    itemMenu.setEnabled(true)
    toolbar.setEnabled(true)
  } catch (error) {
    terminal.print(`Engine initialisation failed: ${error}`, 'error')
    return
  }

  toolbar.onPlay = () => sceneManager.play()
  toolbar.onStop = () => sceneManager.stop()

  // ESC releases pointer lock → revert toolbar
  document.addEventListener('sandbox:stopped', () => toolbar.setPlaying(false))
}

main()

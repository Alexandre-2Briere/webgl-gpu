import { mountComponents }  from './ui/loader'
import { Terminal }          from './ui/Terminal/Terminal'
import { ItemMenu }          from './ui/ItemMenu/ItemMenu'
import { PropertyPanel }     from './ui/PropertyPanel/PropertyPanel'
import { SceneHierarchy }    from './ui/SceneHierarchy/SceneHierarchy'
import { Toolbar }           from './ui/Toolbar/Toolbar'
import { LoadModal }         from './ui/LoadModal/LoadModal'
import { SceneManager }      from './game/SceneManager'
import registryJson          from './items/registry.json'
import type { ItemRegistry, ItemEntry } from './items/types'

async function main(): Promise<void> {
  mountComponents()

  const registry = registryJson as ItemRegistry

  const tabsContainer   = document.getElementById('terminal-tabs')!
  const outputContainer = document.getElementById('terminal-output')!
  const menuContainer   = document.getElementById('item-menu')!
  const canvas          = document.getElementById('webgpu-canvas') as HTMLCanvasElement
  const toolbar         = new Toolbar()
  const loadModal       = new LoadModal()

  const terminal      = new Terminal(tabsContainer, outputContainer)
  const propertyPanel = new PropertyPanel(document.getElementById('property-panel')!)

  // Use a ref object so the hierarchy callbacks always reach the controller instance.
  const controllerRef = { current: null as unknown as SceneManager }
  const sceneHierarchy = new SceneHierarchy(
    document.getElementById('scene-hierarchy')!,
    (index) => controllerRef.current.selectObject(index),
    (index, newName) => controllerRef.current.renameObject(index, newName),
    (index) => controllerRef.current.removeObject(index),
  )

  const controller = new SceneManager(canvas, terminal, propertyPanel, sceneHierarchy)
  controllerRef.current = controller

  const menu = new ItemMenu(
    menuContainer,
    registry,
    (key: string, entry: ItemEntry) => controller.spawn(key, entry),
  )
  menu.setEnabled(false)

  toolbar.onPlay  = () => controller.play()
  toolbar.onStop  = () => controller.stop()
  toolbar.onSave  = async () => {
    const encodedString = await controller.saveScene()
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(encodedString)
      terminal.print('Scene saved — string copied to clipboard.', 'log')
    } else {
      terminal.print('Scene saved (see console for string).', 'log')
      console.log(encodedString)
    }
  }
  toolbar.onLoad  = () => {
    loadModal.open(async (encodedString) => {
      const success = await controller.loadScene(encodedString)
      if (!success) {
        terminal.print('Failed to load scene — invalid or corrupted data.', 'error')
      }
    })
  }

  try {
    await controller.init()
    controller.startLoop()
    menu.setEnabled(true)
    toolbar.setEnabled(true)
  } catch (error) {
    terminal.print(`Engine initialisation failed: ${error}`, 'error')
    return
  }

  // Revert play button when ESC releases the pointer lock
  document.addEventListener('sandbox:stopped', () => {
    toolbar.setPlaying(false)
  })
}

main()

import { createInput, createCheckbox, createSelect, createIconButton } from '../primitives/index'

export interface PropertyPanelElements {
  posX: HTMLInputElement;  posY: HTMLInputElement;  posZ: HTMLInputElement
  rotYaw: HTMLInputElement; rotPitch: HTMLInputElement; rotRoll: HTMLInputElement
  colorInput: HTMLInputElement; colorSwatch: HTMLElement
  scaleX: HTMLInputElement; scaleY: HTMLInputElement; scaleZ: HTMLInputElement
  rbCheckbox: HTMLInputElement; staticCheckbox: HTMLInputElement
  hbCheckbox: HTMLInputElement; layerInput: HTMLInputElement
  assetSelect: HTMLSelectElement
  lightTypeSelect: HTMLSelectElement
  radiusInput: HTMLInputElement; powerInput: HTMLInputElement
}

export function buildPropertyPanelElements(root: HTMLElement, onClose: () => void): PropertyPanelElements {
  const closeButton = createIconButton('×', onClose)
  root.querySelector('.prop-panel-header')!.appendChild(closeButton)

  return {
    ...buildPositionSection(root),
    ...buildRotationSection(root),
    ...buildColorSection(root),
    ...buildScaleSection(root),
    ...buildPhysicsSection(root),
    ...buildAssetSection(root),
    ...buildLightSection(root),
  }
}

function buildPositionSection(root: HTMLElement) {
  const posX = createInput({ type: 'number', step: '0.1' })
  const posY = createInput({ type: 'number', step: '0.1' })
  const posZ = createInput({ type: 'number', step: '0.1' })
  root.querySelector('#prop-pos-x-row')!.appendChild(posX)
  root.querySelector('#prop-pos-y-row')!.appendChild(posY)
  root.querySelector('#prop-pos-z-row')!.appendChild(posZ)
  return { posX, posY, posZ }
}

function buildRotationSection(root: HTMLElement) {
  const rotYaw   = createInput({ type: 'number', step: '1' })
  const rotPitch = createInput({ type: 'number', step: '1' })
  const rotRoll  = createInput({ type: 'number', step: '1' })
  root.querySelector('#prop-rot-yaw-row')!.appendChild(rotYaw)
  root.querySelector('#prop-rot-pitch-row')!.appendChild(rotPitch)
  root.querySelector('#prop-rot-roll-row')!.appendChild(rotRoll)
  return { rotYaw, rotPitch, rotRoll }
}

function buildColorSection(root: HTMLElement) {
  const colorInput  = createInput({ type: 'text', maxLength: 6, placeholder: 'RRGGBB' })
  const colorSwatch = root.querySelector<HTMLElement>('#prop-color-swatch')!
  root.querySelector('#prop-color-row')!.insertBefore(colorInput, colorSwatch)
  return { colorInput, colorSwatch }
}

function buildScaleSection(root: HTMLElement) {
  const scaleX = createInput({ type: 'number', step: '0.1' })
  const scaleY = createInput({ type: 'number', step: '0.1' })
  const scaleZ = createInput({ type: 'number', step: '0.1' })
  root.querySelector('#prop-scale-x-row')!.appendChild(scaleX)
  root.querySelector('#prop-scale-y-row')!.appendChild(scaleY)
  root.querySelector('#prop-scale-z-row')!.appendChild(scaleZ)
  return { scaleX, scaleY, scaleZ }
}

function buildPhysicsSection(root: HTMLElement) {
  const rbCheckbox     = createCheckbox()
  const staticCheckbox = createCheckbox()
  const hbCheckbox     = createCheckbox()
  const layerInput     = createInput({ type: 'text', value: 'default' })
  root.querySelector('#prop-rb-row')!.appendChild(rbCheckbox)
  root.querySelector('#prop-static-row')!.appendChild(staticCheckbox)
  root.querySelector('#prop-hb-row')!.appendChild(hbCheckbox)
  root.querySelector('#prop-layer-row')!.appendChild(layerInput)
  return { rbCheckbox, staticCheckbox, hbCheckbox, layerInput }
}

function buildAssetSection(root: HTMLElement) {
  const assetSelect = createSelect()
  root.querySelector('#prop-asset-select-row')!.appendChild(assetSelect)
  return { assetSelect }
}

function buildLightSection(root: HTMLElement) {
  const lightTypeSelect = createSelect({ options: [
    { value: '0', label: 'Ambient' },
    { value: '1', label: 'Point'   },
  ]})
  const radiusInput = createInput({ type: 'number', step: '0.5', min: '0' })
  const powerInput  = createInput({ type: 'number', step: '0.1', min: '0' })
  root.querySelector('#prop-light-type-row')!.appendChild(lightTypeSelect)
  root.querySelector('#prop-radius-row')!.appendChild(radiusInput)
  root.querySelector('#prop-power-row')!.appendChild(powerInput)
  return { lightTypeSelect, radiusInput, powerInput }
}

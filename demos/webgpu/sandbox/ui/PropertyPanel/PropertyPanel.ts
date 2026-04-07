import './property-panel.css'
import type { ISceneObject } from '../../../../../src/webgpu/engine/index'
import { LightGameObject, LightType } from '../../../../../src/webgpu/engine/gameObject/LightGameObject'
import { safeParseFloat } from '../../../../../src/webgpu/engine/math'
import type { PropertyGroup, PhysicsConfig } from '../../items/types'
import { buildPropertyPanelElements } from './property-panel-elements'

const DEG = Math.PI / 180

export class PropertyPanel {
  private readonly _root: HTMLElement
  private _currentObject: ISceneObject | null = null

  // Callbacks
  onPhysicsChange:   ((config: PhysicsConfig) => void) | null = null
  onScaleChange:     ((x: number, y: number, z: number) => void) | null = null
  onRadiusChange:    ((radius: number) => void) | null = null
  onLightTypeChange: ((type: LightType) => void) | null = null
  onAssetChange:     ((url: string) => void) | null = null
  onPowerChange:     ((power: number) => void) | null = null

  // Position inputs
  private _posX!: HTMLInputElement
  private _posY!: HTMLInputElement
  private _posZ!: HTMLInputElement

  // Rotation inputs (degrees)
  private _rotYaw!:   HTMLInputElement
  private _rotPitch!: HTMLInputElement
  private _rotRoll!:  HTMLInputElement

  // Color input
  private _colorInput!:  HTMLInputElement
  private _colorSwatch!: HTMLElement

  // Scale inputs
  private _scaleX!: HTMLInputElement
  private _scaleY!: HTMLInputElement
  private _scaleZ!: HTMLInputElement

  // Physics inputs
  private _rbCheckbox!:     HTMLInputElement
  private _staticCheckbox!: HTMLInputElement
  private _staticRow!:      HTMLElement
  private _hbCheckbox!:     HTMLInputElement
  private _layerInput!:     HTMLInputElement
  private _layerRow!:       HTMLElement

  // Asset dropdown
  private _assetSection!: HTMLElement
  private _assetSelect!:  HTMLSelectElement

  // Light section
  private _lightSection!:    HTMLElement
  private _lightTypeSelect!: HTMLSelectElement
  private _radiusSection!:   HTMLElement
  private _radiusInput!:     HTMLInputElement
  private _powerSection!:    HTMLElement
  private _powerInput!:      HTMLInputElement

  // Section containers (for show/hide per item)
  private _positionSection!: HTMLElement
  private _rotationSection!: HTMLElement
  private _colorSection!:    HTMLElement
  private _scaleSection!:    HTMLElement
  private _physicsSection!:  HTMLElement

  constructor(root: HTMLElement) {
    this._root = root
    this._queryElements()
    const elements = buildPropertyPanelElements(root, () => this.hide())
    this._posX  = elements.posX
    this._posY  = elements.posY
    this._posZ  = elements.posZ
    this._rotYaw   = elements.rotYaw
    this._rotPitch = elements.rotPitch
    this._rotRoll  = elements.rotRoll
    this._colorInput  = elements.colorInput
    this._colorSwatch = elements.colorSwatch
    this._scaleX = elements.scaleX
    this._scaleY = elements.scaleY
    this._scaleZ = elements.scaleZ
    this._rbCheckbox     = elements.rbCheckbox
    this._staticCheckbox = elements.staticCheckbox
    this._hbCheckbox     = elements.hbCheckbox
    this._layerInput     = elements.layerInput
    this._assetSelect    = elements.assetSelect
    this._lightTypeSelect = elements.lightTypeSelect
    this._radiusInput     = elements.radiusInput
    this._powerInput      = elements.powerInput
    this._attachListeners()
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  setFbxCatalog(catalog: { label: string; url: string }[]): void {
    this._assetSelect.innerHTML = ''
    for (const { label, url } of catalog) {
      const option = document.createElement('option')
      option.value       = url
      option.textContent = label
      this._assetSelect.appendChild(option)
    }
  }

  show(gameObject: ISceneObject, label: string, properties: PropertyGroup[], physicsConfig?: PhysicsConfig, selectedAssetUrl?: string): void {
    // Commit any pending edits to the outgoing object before switching.
    this._applyPosition()
    this._applyRotation()
    this._applyColor()
    this._applyScale()

    this._currentObject = gameObject

    const titleElement = this._root.querySelector<HTMLElement>('#prop-title')!
    titleElement.textContent = label

    // Populate position
    const [posX, posY, posZ] = gameObject.position
    this._posX.value = posX.toFixed(3)
    this._posY.value = posY.toFixed(3)
    this._posZ.value = posZ.toFixed(3)

    // Populate rotation from quaternion
    const [quaternionX, quaternionY, quaternionZ, quaternionW] = gameObject.quaternion
    const yawDeg   = Math.atan2(2*(quaternionW*quaternionY + quaternionZ*quaternionX), 1 - 2*(quaternionY*quaternionY + quaternionZ*quaternionZ)) / DEG
    const pitchDeg = Math.asin(Math.max(-1, Math.min(1, 2*(quaternionW*quaternionX - quaternionY*quaternionZ)))) / DEG
    const rollDeg  = Math.atan2(2*(quaternionW*quaternionZ + quaternionX*quaternionY), 1 - 2*(quaternionZ*quaternionZ + quaternionX*quaternionX)) / DEG
    this._rotYaw.value   = yawDeg.toFixed(1)
    this._rotPitch.value = pitchDeg.toFixed(1)
    this._rotRoll.value  = rollDeg.toFixed(1)

    // Populate scale
    const [scaleX, scaleY, scaleZ] = gameObject.scale
    this._scaleX.value = scaleX.toFixed(3)
    this._scaleY.value = scaleY.toFixed(3)
    this._scaleZ.value = scaleZ.toFixed(3)

    // Populate color from current object tint
    if (properties.includes('color')) {
      const [colorRed, colorGreen, colorBlue] = gameObject.color
      const toHex = (value: number) => Math.round(value * 255).toString(16).padStart(2, '0').toUpperCase()
      this._colorInput.value = `${toHex(colorRed)}${toHex(colorGreen)}${toHex(colorBlue)}`
      this._updateSwatch()
    }

    // Populate physics section
    const showPhysics = properties.includes('rigidbody') || properties.includes('hitbox')
    if (showPhysics && physicsConfig) {
      this._rbCheckbox.checked      = physicsConfig.hasRigidbody
      this._staticCheckbox.checked  = physicsConfig.isStatic
      this._staticRow.style.display = physicsConfig.hasRigidbody ? '' : 'none'
      this._hbCheckbox.checked      = physicsConfig.hasHitbox
      this._layerInput.value        = physicsConfig.layer
      this._layerRow.style.display  = physicsConfig.hasHitbox ? '' : 'none'
    }

    // Show/hide sections per item definition
    this._positionSection.style.display = properties.includes('position') ? '' : 'none'
    this._rotationSection.style.display = properties.includes('rotation') ? '' : 'none'
    this._colorSection.style.display    = properties.includes('color')    ? '' : 'none'
    this._scaleSection.style.display    = properties.includes('scale')    ? '' : 'none'
    this._physicsSection.style.display  = showPhysics ? '' : 'none'

    const showAsset = properties.includes('asset')
    this._assetSection.style.display = showAsset ? '' : 'none'
    if (showAsset && selectedAssetUrl !== undefined) {
      this._assetSelect.value = selectedAssetUrl
    }

    // Light section — only shown for LightGameObjects
    const showLight = properties.includes('lightType') || properties.includes('lightRadius') || properties.includes('lightPower')
    this._lightSection.style.display = showLight ? '' : 'none'
    if (showLight && gameObject instanceof LightGameObject) {
      this._lightTypeSelect.value = String(gameObject.lightType)
      this._radiusSection.style.display = gameObject.lightType === LightType.Point ? '' : 'none'
      if (properties.includes('lightRadius')) {
        this._radiusInput.value = gameObject.radius.toFixed(1)
      }
      this._powerSection.style.display = properties.includes('lightPower') ? '' : 'none'
      if (properties.includes('lightPower')) {
        this._powerInput.value = gameObject.radius.toFixed(2)
      }
    }

    this._root.classList.add('open')
  }

  hide(): void {
    this._currentObject = null
    this._root.classList.remove('open')
  }

  get currentObject(): ISceneObject | null {
    return this._currentObject
  }

  setTitle(label: string): void {
    const titleElement = this._root.querySelector<HTMLElement>('#prop-title')
    if (titleElement) titleElement.textContent = label
  }

  setPosition(x: number, y: number, z: number): void {
    this._posX.value = x.toFixed(3)
    this._posY.value = y.toFixed(3)
    this._posZ.value = z.toFixed(3)
    this._applyPosition()
  }

  // ── Query structural elements ───────────────────────────────────────────────

  private _queryElements(): void {
    const root = this._root

    this._staticRow = root.querySelector<HTMLElement>('#prop-static-row')!
    this._layerRow  = root.querySelector<HTMLElement>('#prop-layer-row')!

    this._assetSection = root.querySelector<HTMLElement>('#prop-section-asset')!

    this._lightSection  = root.querySelector<HTMLElement>('#prop-section-light')!
    this._radiusSection = root.querySelector<HTMLElement>('#prop-radius-row')!
    this._powerSection  = root.querySelector<HTMLElement>('#prop-power-row')!

    this._positionSection = root.querySelector<HTMLElement>('#prop-section-position')!
    this._rotationSection = root.querySelector<HTMLElement>('#prop-section-rotation')!
    this._colorSection    = root.querySelector<HTMLElement>('#prop-section-color')!
    this._scaleSection    = root.querySelector<HTMLElement>('#prop-section-scale')!
    this._physicsSection  = root.querySelector<HTMLElement>('#prop-section-physics')!
  }

  private _attachListeners(): void {
    this._posX.addEventListener('change', () => this._applyPosition())
    this._posY.addEventListener('change', () => this._applyPosition())
    this._posZ.addEventListener('change', () => this._applyPosition())

    this._rotYaw.addEventListener('change',   () => this._applyRotation())
    this._rotPitch.addEventListener('change', () => this._applyRotation())
    this._rotRoll.addEventListener('change',  () => this._applyRotation())

    this._colorInput.addEventListener('change', () => this._applyColor())
    this._colorInput.addEventListener('input',  () => this._updateSwatch())

    this._scaleX.addEventListener('change', () => this._applyScale())
    this._scaleY.addEventListener('change', () => this._applyScale())
    this._scaleZ.addEventListener('change', () => this._applyScale())

    this._rbCheckbox.addEventListener('change', () => {
      this._staticRow.style.display = this._rbCheckbox.checked ? '' : 'none'
      this._applyPhysics()
    })
    this._staticCheckbox.addEventListener('change', () => this._applyPhysics())
    this._hbCheckbox.addEventListener('change', () => {
      this._layerRow.style.display = this._hbCheckbox.checked ? '' : 'none'
      this._applyPhysics()
    })
    this._layerInput.addEventListener('change', () => this._applyPhysics())

    this._assetSelect.addEventListener('change', () => this.onAssetChange?.(this._assetSelect.value))

    this._lightTypeSelect.addEventListener('change', () => {
      this._radiusSection.style.display = this._lightTypeSelect.value === String(LightType.Point) ? '' : 'none'
      this.onLightTypeChange?.(parseInt(this._lightTypeSelect.value) as LightType)
    })
    this._radiusInput.addEventListener('change', () => this.onRadiusChange?.(safeParseFloat(this._radiusInput.value)))
    this._powerInput.addEventListener('change',  () => this.onPowerChange?.(safeParseFloat(this._powerInput.value)))
  }

  // ── Apply handlers ──────────────────────────────────────────────────────────

  private _applyPosition(): void {
    if (!this._currentObject) return
    const x = safeParseFloat(this._posX.value)
    const y = safeParseFloat(this._posY.value)
    const z = safeParseFloat(this._posZ.value)
    this._currentObject.setPosition([x, y, z])
  }

  private _applyRotation(): void {
    if (!this._currentObject) return
    const yawRad   = safeParseFloat(this._rotYaw.value)   * DEG
    const pitchRad = safeParseFloat(this._rotPitch.value) * DEG
    const rollRad  = safeParseFloat(this._rotRoll.value)  * DEG
    this._currentObject.setRotation(yawRad, pitchRad, rollRad)
  }

  private _applyColor(): void {
    if (!this._currentObject) return
    const hex = this._colorInput.value.trim().toUpperCase()
    if (!/^[0-9A-F]{6}$/.test(hex)) return
    const red   = parseInt(hex.slice(0, 2), 16) / 255
    const green = parseInt(hex.slice(2, 4), 16) / 255
    const blue  = parseInt(hex.slice(4, 6), 16) / 255
    this._currentObject.setColor(red, green, blue, 1.0)
    this._updateSwatch()
  }

  private _applyScale(): void {
    if (!this._currentObject) return
    const x = safeParseFloat(this._scaleX.value, 1)
    const y = safeParseFloat(this._scaleY.value, 1)
    const z = safeParseFloat(this._scaleZ.value, 1)
    this._currentObject.setScale(x, y, z)
    this.onScaleChange?.(x, y, z)
  }

  private _applyPhysics(): void {
    const config: PhysicsConfig = {
      hasRigidbody: this._rbCheckbox.checked,
      isStatic:     this._staticCheckbox.checked,
      hasHitbox:    this._hbCheckbox.checked,
      layer:        this._layerInput.value.trim() || 'default',
    }
    this.onPhysicsChange?.(config)
  }

  private _updateSwatch(): void {
    const hex = this._colorInput.value.trim()
    if (/^[0-9A-Fa-f]{6}$/.test(hex)) {
      this._colorSwatch.style.background = `#${hex}`
    } else {
      this._colorSwatch.style.background = ''
    }
  }
}

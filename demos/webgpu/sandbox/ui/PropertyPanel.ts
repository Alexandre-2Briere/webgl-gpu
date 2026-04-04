import type { ISceneObject } from '../../../../src/webgpu/engine/index'
import { LightGameObject, LightType } from '../../../../src/webgpu/engine/gameObject/LightGameObject'
import { safeParseFloat } from '../../../../src/webgpu/engine/math'
import type { PropertyGroup, PhysicsConfig } from '../items/types'

const DEG = Math.PI / 180

export class PropertyPanel {
  private readonly _root: HTMLElement
  private _currentObject: ISceneObject | null = null

  // Callbacks
  onPhysicsChange:   ((config: PhysicsConfig) => void) | null = null
  onScaleChange:     ((x: number, y: number, z: number) => void) | null = null
  onRadiusChange:    ((radius: number) => void) | null = null
  onLightTypeChange: ((type: LightType) => void) | null = null

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
  private _rbCheckbox!:    HTMLInputElement
  private _staticCheckbox!: HTMLInputElement
  private _staticRow!:     HTMLElement
  private _hbCheckbox!:    HTMLInputElement
  private _layerInput!:    HTMLInputElement
  private _layerRow!:      HTMLElement

  // Asset dropdown
  private _assetSection!: HTMLElement
  private _assetSelect!:  HTMLSelectElement
  onAssetChange:  ((url: string) => void) | null = null
  onPowerChange:  ((power: number) => void) | null = null

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
    this._build()
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

    const titleEl = this._root.querySelector('.prop-panel-title') as HTMLElement
    titleEl.textContent = label

    // Populate position
    const [posX, posY, posZ] = gameObject.position
    this._posX.value = posX.toFixed(3)
    this._posY.value = posY.toFixed(3)
    this._posZ.value = posZ.toFixed(3)

    // Populate rotation from quaternion
    const [qx, qy, qz, qw] = gameObject.quaternion
    const yawDeg   = Math.atan2(2*(qw*qy + qz*qx), 1 - 2*(qy*qy + qz*qz)) / DEG
    const pitchDeg = Math.asin(Math.max(-1, Math.min(1, 2*(qw*qx - qy*qz)))) / DEG
    const rollDeg  = Math.atan2(2*(qw*qz + qx*qy), 1 - 2*(qz*qz + qx*qx)) / DEG
    this._rotYaw.value   = yawDeg.toFixed(1)
    this._rotPitch.value = pitchDeg.toFixed(1)
    this._rotRoll.value  = rollDeg.toFixed(1)

    // Populate scale
    const [sx, sy, sz] = gameObject.scale
    this._scaleX.value = sx.toFixed(3)
    this._scaleY.value = sy.toFixed(3)
    this._scaleZ.value = sz.toFixed(3)

    // Populate color from current object tint
    if (properties.includes('color')) {
      const [cr, cg, cb] = gameObject.color
      const toHex = (v: number) => Math.round(v * 255).toString(16).padStart(2, '0').toUpperCase()
      this._colorInput.value = `${toHex(cr)}${toHex(cg)}${toHex(cb)}`
      this._updateSwatch()
    }

    // Populate physics section
    const showPhysics = properties.includes('rigidbody') || properties.includes('hitbox')
    if (showPhysics && physicsConfig) {
      this._rbCheckbox.checked     = physicsConfig.hasRigidbody
      this._staticCheckbox.checked = physicsConfig.isStatic
      this._staticRow.style.display = physicsConfig.hasRigidbody ? '' : 'none'
      this._hbCheckbox.checked     = physicsConfig.hasHitbox
      this._layerInput.value       = physicsConfig.layer
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
    const titleEl = this._root.querySelector('.prop-panel-title') as HTMLElement
    if (titleEl) titleEl.textContent = label
  }

  // ── Build DOM ───────────────────────────────────────────────────────────────

  private _build(): void {
    const inner = document.createElement('div')
    inner.className = 'prop-panel-inner'

    // Header
    const header = document.createElement('div')
    header.className = 'prop-panel-header'
    const title = document.createElement('h2')
    title.className   = 'prop-panel-title'
    title.textContent = ''
    const closeBtn = document.createElement('button')
    closeBtn.className   = 'prop-panel-close'
    closeBtn.textContent = '×'
    closeBtn.addEventListener('click', () => this.hide())
    header.append(title, closeBtn)

    // Body
    const body = document.createElement('div')
    body.className = 'prop-panel-body'

    this._positionSection = this._buildPositionSection()
    this._rotationSection = this._buildRotationSection()
    this._colorSection    = this._buildColorSection()
    this._scaleSection    = this._buildScaleSection()
    this._physicsSection  = this._buildPhysicsSection()
    this._assetSection    = this._buildAssetSection()
    this._lightSection    = this._buildLightSection()

    body.appendChild(this._positionSection)
    body.appendChild(this._rotationSection)
    body.appendChild(this._colorSection)
    body.appendChild(this._scaleSection)
    body.appendChild(this._physicsSection)
    body.appendChild(this._assetSection)
    body.appendChild(this._lightSection)

    inner.append(header, body)
    this._root.appendChild(inner)
  }

  private _buildPositionSection(): HTMLElement {
    const section = document.createElement('div')

    const sectionLabel = document.createElement('div')
    sectionLabel.className   = 'prop-section-label'
    sectionLabel.textContent = 'Position'
    section.appendChild(sectionLabel)

    for (const axis of ['X', 'Y', 'Z'] as const) {
      const row = document.createElement('div')
      row.className = 'prop-row'

      const axisLabel = document.createElement('span')
      axisLabel.className   = 'prop-axis-label'
      axisLabel.textContent = axis

      const input = document.createElement('input')
      input.type      = 'number'
      input.step      = '0.1'
      input.className = 'prop-input'
      input.addEventListener('change', () => this._applyPosition())

      if (axis === 'X')      this._posX = input
      else if (axis === 'Y') this._posY = input
      else                   this._posZ = input

      row.append(axisLabel, input)
      section.appendChild(row)
    }

    return section
  }

  private _buildRotationSection(): HTMLElement {
    const section = document.createElement('div')

    const sectionLabel = document.createElement('div')
    sectionLabel.className   = 'prop-section-label'
    sectionLabel.textContent = 'Rotation (deg)'
    section.appendChild(sectionLabel)

    const axes = [['Y', 'Yaw'], ['P', 'Pitch'], ['R', 'Roll']] as const
    for (const [axis, key] of axes) {
      const row = document.createElement('div')
      row.className = 'prop-row'

      const axisLabel = document.createElement('span')
      axisLabel.className   = 'prop-axis-label'
      axisLabel.textContent = axis

      const input = document.createElement('input')
      input.type      = 'number'
      input.step      = '1'
      input.className = 'prop-input'
      input.addEventListener('change', () => this._applyRotation())

      if (key === 'Yaw')        this._rotYaw   = input
      else if (key === 'Pitch') this._rotPitch = input
      else                      this._rotRoll  = input

      row.append(axisLabel, input)
      section.appendChild(row)
    }

    return section
  }

  private _buildColorSection(): HTMLElement {
    const section = document.createElement('div')

    const sectionLabel = document.createElement('div')
    sectionLabel.className   = 'prop-section-label'
    sectionLabel.textContent = 'Color (hex)'
    section.appendChild(sectionLabel)

    const colorRow = document.createElement('div')
    colorRow.className = 'prop-color-row'

    const prefix = document.createElement('span')
    prefix.className   = 'prop-color-prefix'
    prefix.textContent = '#'

    const colorInput = document.createElement('input')
    colorInput.type      = 'text'
    colorInput.maxLength = 6
    colorInput.placeholder = 'RRGGBB'
    colorInput.className = 'prop-color-input'
    colorInput.addEventListener('change', () => this._applyColor())
    colorInput.addEventListener('input',  () => this._updateSwatch())
    this._colorInput = colorInput

    const swatch = document.createElement('div')
    swatch.className    = 'prop-color-swatch'
    this._colorSwatch   = swatch

    colorRow.append(prefix, colorInput, swatch)
    section.appendChild(colorRow)

    return section
  }

  private _buildScaleSection(): HTMLElement {
    const section = document.createElement('div')

    const sectionLabel = document.createElement('div')
    sectionLabel.className   = 'prop-section-label'
    sectionLabel.textContent = 'Scale'
    section.appendChild(sectionLabel)

    for (const axis of ['X', 'Y', 'Z'] as const) {
      const row = document.createElement('div')
      row.className = 'prop-row'

      const axisLabel = document.createElement('span')
      axisLabel.className   = 'prop-axis-label'
      axisLabel.textContent = axis

      const input = document.createElement('input')
      input.type      = 'number'
      input.step      = '0.1'
      input.className = 'prop-input'
      input.addEventListener('change', () => this._applyScale())

      if (axis === 'X')      this._scaleX = input
      else if (axis === 'Y') this._scaleY = input
      else                   this._scaleZ = input

      row.append(axisLabel, input)
      section.appendChild(row)
    }

    return section
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
    const r = parseInt(hex.slice(0, 2), 16) / 255
    const g = parseInt(hex.slice(2, 4), 16) / 255
    const b = parseInt(hex.slice(4, 6), 16) / 255
    this._currentObject.setColor(r, g, b, 1.0)
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

  private _buildPhysicsSection(): HTMLElement {
    const section = document.createElement('div')

    const sectionLabel = document.createElement('div')
    sectionLabel.className   = 'prop-section-label'
    sectionLabel.textContent = 'Physics'
    section.appendChild(sectionLabel)

    // Rigidbody row
    const rbRow = document.createElement('div')
    rbRow.className = 'prop-row'
    const rbLabel = document.createElement('span')
    rbLabel.className   = 'prop-label'
    rbLabel.textContent = 'Rigidbody'
    const rbCheckbox = document.createElement('input')
    rbCheckbox.type      = 'checkbox'
    rbCheckbox.className = 'prop-checkbox'
    rbCheckbox.addEventListener('change', () => {
      this._staticRow.style.display = rbCheckbox.checked ? '' : 'none'
      this._applyPhysics()
    })
    this._rbCheckbox = rbCheckbox
    rbRow.append(rbLabel, rbCheckbox)
    section.appendChild(rbRow)

    // Static sub-row
    const staticRow = document.createElement('div')
    staticRow.className    = 'prop-row prop-subrow'
    staticRow.style.display = 'none'
    const staticLabel = document.createElement('span')
    staticLabel.className   = 'prop-label'
    staticLabel.textContent = 'Static'
    const staticCheckbox = document.createElement('input')
    staticCheckbox.type      = 'checkbox'
    staticCheckbox.className = 'prop-checkbox'
    staticCheckbox.addEventListener('change', () => this._applyPhysics())
    this._staticCheckbox = staticCheckbox
    this._staticRow      = staticRow
    staticRow.append(staticLabel, staticCheckbox)
    section.appendChild(staticRow)

    // Hitbox row
    const hbRow = document.createElement('div')
    hbRow.className = 'prop-row'
    const hbLabel = document.createElement('span')
    hbLabel.className   = 'prop-label'
    hbLabel.textContent = 'Hitbox'
    const hbCheckbox = document.createElement('input')
    hbCheckbox.type      = 'checkbox'
    hbCheckbox.className = 'prop-checkbox'
    hbCheckbox.addEventListener('change', () => {
      this._layerRow.style.display = hbCheckbox.checked ? '' : 'none'
      this._applyPhysics()
    })
    this._hbCheckbox = hbCheckbox
    hbRow.append(hbLabel, hbCheckbox)
    section.appendChild(hbRow)

    // Layer sub-row
    const layerRow = document.createElement('div')
    layerRow.className    = 'prop-row prop-subrow'
    layerRow.style.display = 'none'
    const layerLabel = document.createElement('span')
    layerLabel.className   = 'prop-label'
    layerLabel.textContent = 'Layer'
    const layerInput = document.createElement('input')
    layerInput.type      = 'text'
    layerInput.className = 'prop-input'
    layerInput.value     = 'default'
    layerInput.addEventListener('change', () => this._applyPhysics())
    this._layerInput = layerInput
    this._layerRow   = layerRow
    layerRow.append(layerLabel, layerInput)
    section.appendChild(layerRow)

    return section
  }

  private _buildAssetSection(): HTMLElement {
    const section = document.createElement('div')

    const sectionLabel = document.createElement('div')
    sectionLabel.className   = 'prop-section-label'
    sectionLabel.textContent = 'Asset'
    section.appendChild(sectionLabel)

    const row = document.createElement('div')
    row.className = 'prop-row'

    const select = document.createElement('select')
    select.className = 'prop-input'
    select.addEventListener('change', () => this.onAssetChange?.(select.value))
    this._assetSelect = select

    row.appendChild(select)
    section.appendChild(row)

    return section
  }

  private _buildLightSection(): HTMLElement {
    const section = document.createElement('div')

    const sectionLabel = document.createElement('div')
    sectionLabel.className   = 'prop-section-label'
    sectionLabel.textContent = 'Light'
    section.appendChild(sectionLabel)

    // Type row
    const typeRow = document.createElement('div')
    typeRow.className = 'prop-row'

    const typeLabel = document.createElement('span')
    typeLabel.className   = 'prop-label'
    typeLabel.textContent = 'Type'

    const select = document.createElement('select')
    select.className = 'prop-input'

    const ambientOption = document.createElement('option')
    ambientOption.value       = String(LightType.Ambient)
    ambientOption.textContent = 'Ambient'

    const pointOption = document.createElement('option')
    pointOption.value       = String(LightType.Point)
    pointOption.textContent = 'Point'

    select.append(ambientOption, pointOption)
    select.addEventListener('change', () => {
      this._radiusSection.style.display = select.value === String(LightType.Point) ? '' : 'none'
      this.onLightTypeChange?.(parseInt(select.value) as LightType)
    })
    this._lightTypeSelect = select

    typeRow.append(typeLabel, select)
    section.appendChild(typeRow)

    // Radius sub-row
    const radiusRow = document.createElement('div')
    radiusRow.className = 'prop-row prop-subrow'

    const radiusLabel = document.createElement('span')
    radiusLabel.className   = 'prop-label'
    radiusLabel.textContent = 'Radius'

    const radiusInput = document.createElement('input')
    radiusInput.type      = 'number'
    radiusInput.step      = '0.5'
    radiusInput.min       = '0'
    radiusInput.className = 'prop-input'
    radiusInput.addEventListener('change', () => this.onRadiusChange?.(safeParseFloat(radiusInput.value)))
    this._radiusInput = radiusInput

    this._radiusSection = radiusRow
    radiusRow.append(radiusLabel, radiusInput)
    section.appendChild(radiusRow)

    // Power row (for directional lights)
    const powerRow = document.createElement('div')
    powerRow.className = 'prop-row'

    const powerLabel = document.createElement('span')
    powerLabel.className   = 'prop-label'
    powerLabel.textContent = 'Power'

    const powerInput = document.createElement('input')
    powerInput.type      = 'number'
    powerInput.step      = '0.1'
    powerInput.min       = '0'
    powerInput.className = 'prop-input'
    powerInput.addEventListener('change', () => this.onPowerChange?.(safeParseFloat(powerInput.value)))
    this._powerInput = powerInput

    this._powerSection = powerRow
    powerRow.append(powerLabel, powerInput)
    section.appendChild(powerRow)

    return section
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

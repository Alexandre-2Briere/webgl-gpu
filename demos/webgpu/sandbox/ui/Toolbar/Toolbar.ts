import './toolbar.css'
import { createButton } from '../primitives/index'

export class Toolbar {
  private readonly _playButton: HTMLButtonElement
  private readonly _saveButton: HTMLButtonElement
  private readonly _loadButton: HTMLButtonElement

  onPlay: (() => void) | null = null
  onStop: (() => void) | null = null
  onSave: (() => void) | null = null
  onLoad: (() => void) | null = null

  constructor() {
    const toolbar = document.getElementById('toolbar')!
    this._playButton = createButton('Play', () => {
      if (this._isPlaying()) {
        this.onStop?.()
        this.setPlaying(false)
      } else {
        this.onPlay?.()
        this.setPlaying(true)
      }
    }, { disabled: true })
    this._playButton.id = 'play-btn'
    toolbar.appendChild(this._playButton)

    this._saveButton = createButton('Save', () => { this.onSave?.() }, { disabled: true })
    toolbar.appendChild(this._saveButton)

    this._loadButton = createButton('Load', () => { this.onLoad?.() }, { disabled: true })
    toolbar.appendChild(this._loadButton)
  }

  setPlaying(playing: boolean): void {
    this._playButton.textContent = playing ? 'Stop' : 'Play'
    this._playButton.classList.toggle('playing', playing)
  }

  setEnabled(enabled: boolean): void {
    this._playButton.disabled = !enabled
    this._saveButton.disabled = !enabled
    this._loadButton.disabled = !enabled
  }

  private _isPlaying(): boolean {
    return this._playButton.classList.contains('playing')
  }
}

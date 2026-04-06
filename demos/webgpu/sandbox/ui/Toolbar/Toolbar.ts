import './toolbar.css'

export class Toolbar {
  private readonly _playButton: HTMLButtonElement

  onPlay: (() => void) | null = null
  onStop: (() => void) | null = null

  constructor() {
    this._playButton = document.getElementById('play-btn') as HTMLButtonElement
    this._playButton.addEventListener('click', () => {
      if (this._isPlaying()) {
        this.onStop?.()
        this.setPlaying(false)
      } else {
        this.onPlay?.()
        this.setPlaying(true)
      }
    })
  }

  setPlaying(playing: boolean): void {
    this._playButton.textContent = playing ? 'Stop' : 'Play'
    this._playButton.classList.toggle('playing', playing)
  }

  setEnabled(enabled: boolean): void {
    this._playButton.disabled = !enabled
  }

  private _isPlaying(): boolean {
    return this._playButton.classList.contains('playing')
  }
}

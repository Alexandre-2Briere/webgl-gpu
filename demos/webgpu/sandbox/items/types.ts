export type PropertyGroup = 'position' | 'rotation' | 'color' | 'scale'

export interface ItemEntry {
  key:        string
  label:      string
  isReady:    boolean
  properties: PropertyGroup[]
}

export type ItemRegistry = Record<string, ItemEntry[]>

export interface HighlightedToken {
  content: string
  color: string
  bold?: boolean
  italic?: boolean
  dim?: boolean
}

export type HighlightedLine = HighlightedToken[]

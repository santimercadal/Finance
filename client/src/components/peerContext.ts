import { createContext } from 'react'

// Peer medians for the stock being viewed, so every MetricStat can show how
// the company compares without threading props through each tab.
export interface PeerMedians {
  loading: boolean
  medians: Record<string, number | null>
  count: number
}

export const PeerContext = createContext<PeerMedians>({ loading: false, medians: {}, count: 0 })

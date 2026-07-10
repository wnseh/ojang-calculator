import { useEffect, useMemo, useReducer } from 'react'
import { HistoryScreen } from './components/HistoryScreen'
import { LedgerScreen } from './components/LedgerScreen'
import { PlayScreen } from './components/PlayScreen'
import { SetupScreen } from './components/SetupScreen'
import { settle } from './engine/settlement'
import { loadState, reducer, saveState } from './store'

export default function App() {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  useEffect(() => {
    saveState(state)
  }, [state])

  const settlement = useMemo(
    () => (state.config ? settle(state.config, state.holes) : null),
    [state.config, state.holes],
  )

  if (state.screen === 'history') {
    return <HistoryScreen dispatch={dispatch} hasActiveRound={!!state.config} />
  }

  if (state.screen === 'setup' || !state.config || !settlement) {
    return (
      <SetupScreen
        onStart={(config) =>
          dispatch({
            type: 'START_ROUND',
            config,
            startedAt: new Date().toISOString().slice(0, 10),
          })
        }
        onShowHistory={() => dispatch({ type: 'SET_SCREEN', screen: 'history' })}
      />
    )
  }

  if (state.screen === 'ledger') {
    return <LedgerScreen state={state} dispatch={dispatch} settlement={settlement} />
  }

  return <PlayScreen state={state} dispatch={dispatch} settlement={settlement} />
}

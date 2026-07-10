import { useEffect, useMemo, useReducer } from 'react'
import { HistoryScreen } from './components/HistoryScreen'
import { LedgerScreen } from './components/LedgerScreen'
import { PlayScreen } from './components/PlayScreen'
import { SetupScreen } from './components/SetupScreen'
import { TeeOrderModal } from './components/TeeOrderModal'
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
        onStart={(config, meta) =>
          dispatch({
            type: 'START_ROUND',
            config,
            startedAt: new Date().toISOString().slice(0, 10),
            club: meta.club,
            course: meta.course,
          })
        }
        onShowHistory={() => dispatch({ type: 'SET_SCREEN', screen: 'history' })}
      />
    )
  }

  if (state.screen === 'ledger') {
    return <LedgerScreen state={state} dispatch={dispatch} settlement={settlement} />
  }

  return (
    <>
      <PlayScreen state={state} dispatch={dispatch} settlement={settlement} />
      {state.showTeeOrder && (
        <TeeOrderModal
          players={state.config.players}
          onApply={(order) => {
            dispatch({ type: 'REORDER_PLAYERS', order })
            dispatch({ type: 'DISMISS_TEE_ORDER' })
          }}
          onClose={() => dispatch({ type: 'DISMISS_TEE_ORDER' })}
        />
      )}
    </>
  )
}

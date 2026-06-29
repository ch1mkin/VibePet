import {
  IPC,
  type IpcEventChannel,
  type IpcEventMap,
  type IpcInvokeChannel,
  type IpcInvokeMap
} from '@shared/ipc-contract'

/**
 * Renderer-side typed access to the preload bridge (`window.vibeduck`).
 *
 * Channel names come from the shared `IPC` constant (safe at module load), while
 * `invoke`/`on` call through the preload bridge lazily — so importing this module
 * never crashes even if the bridge isn't ready yet.
 */
export const ipc = {
  invoke<C extends IpcInvokeChannel>(
    channel: C,
    ...args: IpcInvokeMap[C]['args']
  ): Promise<IpcInvokeMap[C]['result']> {
    const bridge = window.vibeduck
    if (!bridge) {
      // The preload bridge can be momentarily absent (e.g. a window created while
      // electron-vite is reloading the preload in dev). Fail soft instead of
      // throwing synchronously and tearing down the whole React tree.
      console.warn(`[VibeDuck] bridge unavailable; dropped invoke "${channel}"`)
      return Promise.reject(new Error('VibeDuck bridge unavailable'))
    }
    return bridge.invoke(channel, ...args)
  },
  on<C extends IpcEventChannel>(channel: C, listener: (payload: IpcEventMap[C]) => void): () => void {
    const bridge = window.vibeduck
    if (!bridge) {
      console.warn(`[VibeDuck] bridge unavailable; dropped listener "${channel}"`)
      return () => {}
    }
    return bridge.on(channel, listener)
  },
  channels: IPC
}

import type {
  IPC,
  IpcEventChannel,
  IpcEventMap,
  IpcInvokeChannel,
  IpcInvokeMap
} from './ipc-contract'

/**
 * Shape of the API exposed to the renderer via `window.vibeduck`.
 *
 * Defined in `shared` (not in the preload module) so both the preload
 * implementation and the renderer's global typing can reference it without
 * either process depending on the other's source files.
 */
export interface VibeDuckBridge {
  invoke<C extends IpcInvokeChannel>(
    channel: C,
    ...args: IpcInvokeMap[C]['args']
  ): Promise<IpcInvokeMap[C]['result']>
  on<C extends IpcEventChannel>(channel: C, listener: (payload: IpcEventMap[C]) => void): () => void
  channels: typeof IPC
}

import { contextBridge, ipcRenderer } from 'electron'
import {
  IPC,
  type IpcEventChannel,
  type IpcEventMap,
  type IpcInvokeChannel,
  type IpcInvokeMap
} from '@shared/ipc-contract'
import type { VibeDuckBridge } from '@shared/bridge'

/**
 * Typed bridge exposed to the renderer as `window.vibeduck`.
 * No business logic lives here — it only forwards to the main process.
 */
const api: VibeDuckBridge = {
  invoke<C extends IpcInvokeChannel>(
    channel: C,
    ...args: IpcInvokeMap[C]['args']
  ): Promise<IpcInvokeMap[C]['result']> {
    return ipcRenderer.invoke(channel, ...args)
  },

  on<C extends IpcEventChannel>(channel: C, listener: (payload: IpcEventMap[C]) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, payload: IpcEventMap[C]): void =>
      listener(payload)
    ipcRenderer.on(channel, handler)
    return () => ipcRenderer.removeListener(channel, handler)
  },

  channels: IPC
}

contextBridge.exposeInMainWorld('vibeduck', api)

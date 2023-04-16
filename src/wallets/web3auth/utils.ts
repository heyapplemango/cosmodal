import { FromWorkerMessage, ToWorkerMessage } from "./types"

// Listen for a message and remove the listener if the callback returns true or
// if it throws an error.
export const listenOnce = (
  worker: Worker,
  callback: (message: FromWorkerMessage) => boolean | Promise<boolean>
) => {
  const listener = async ({ data }: MessageEvent<FromWorkerMessage>) => {
    let remove
    try {
      remove = await callback(data)
    } catch (error) {
      console.error(error)
      remove = true
    }

    if (remove) {
      worker.removeEventListener("message", listener)
    }
  }

  worker.addEventListener("message", listener)
}

// Send message to worker and listen for a response. Returns a promise that
// resolves when the callback returns true and rejects if it throws an error.
export const sendAndListenOnce = (
  worker: Worker,
  message: ToWorkerMessage,
  callback: (message: FromWorkerMessage) => boolean | Promise<boolean>
): Promise<void> =>
  new Promise<void>((resolve, reject) => {
    listenOnce(worker, async (data) => {
      try {
        if (await callback(data)) {
          resolve()
          return true
        } else {
          return false
        }
      } catch (err) {
        reject(err)
        return true
      }
    })

    worker.postMessage(message)
  })

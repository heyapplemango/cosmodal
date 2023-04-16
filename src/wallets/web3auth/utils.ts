import { sha256 } from "@cosmjs/crypto"
import { toUtf8 } from "@cosmjs/encoding"
import eccrypto, { Ecies } from "@toruslabs/eccrypto"

import { FromWorkerMessage, ToWorkerMessage } from "./types"

// In case these get overwritten by an attacker.
const postMessage =
  typeof Worker !== "undefined" ? Worker.prototype.postMessage : undefined
const addEventListener =
  typeof Worker !== "undefined" ? Worker.prototype.addEventListener : undefined
const removeEventListener =
  typeof Worker !== "undefined"
    ? Worker.prototype.removeEventListener
    : undefined

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      removeEventListener?.call(worker, "message", listener as any)
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  addEventListener?.call(worker, "message", listener as any)
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

    postMessage?.call(worker, message)
  })

export const decrypt = async (
  privateKey: Uint8Array | Buffer,
  { iv, ephemPublicKey, ciphertext, mac }: Ecies
): Promise<Buffer> =>
  await eccrypto.decrypt(
    Buffer.from(privateKey),
    // Convert Uint8Array to Buffer.
    {
      iv: Buffer.from(iv),
      ephemPublicKey: Buffer.from(ephemPublicKey),
      ciphertext: Buffer.from(ciphertext),
      mac: Buffer.from(mac),
    }
  )

// Used for signing and verifying objects.
export const hashObject = (object: unknown): Buffer =>
  Buffer.from(sha256(toUtf8(JSON.stringify(object))))

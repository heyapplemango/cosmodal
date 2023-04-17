# Web3Auth wallet

This wallet is a wrapper around [Web3Auth's
SDK](https://web3auth.io/docs/sdk/web/) to securely create a Cosmos wallet
with a social login.

## Security

### Introduction

Most wallets exist as browser extensions or mobile apps. Their primary security
model, assuming private keys are stored and handled securely, lies in the fact
that signing is done in an isolated environment (i.e. not in the browser). This
allows the extension/app to decide the conditions under which a transaction gets
signed—the conditions typically being a human's manual approval. Critically, the
private key exists in a secure environment and never leaves it. Even if the
browser is compromised, be it a malicious extension or XSS attack, the private
key is safe.

This wallet is different. It exists entirely within the browser. A browser
extension or mobile app _could_ be built on top of
[Web3Auth](https://web3auth.io), which would be safer, but this is not case
here. This wallet's purpose is to streamline the process of creating and using
web3 via the familiar web2 SSO model. This means we have to be very intentional
about how the private key can be accessed and under what conditions a
transaction will be signed when requested.

### Initial considerations

To start, we must assume browsers are sufficiently safe. This is likely not
true, but a lot of effort is put into making them secure, and it would be a very
big deal for everyone if browser memory were not sufficiently safe. Also, we are
deciding to build an internal wallet, so we have no choice.

We must also trust the Web3Auth SDK and the Web3Auth service itself. They have
received a few audits, found [here](https://github.com/torusresearch/audit),
which seem to have gone well. Reading through the open-source SDK code
([@web3auth/no-modal](https://github.com/Web3Auth/web3auth-web/tree/master/packages/no-modal),
[@web3auth/openlogin-adapter](https://github.com/Web3Auth/web3auth-web/tree/master/packages/adapters/openlogin-adapter),
and [@toruslabs/openlogin](https://github.com/torusresearch/OpenLoginSdk)) shows
a pretty straightforward authentication management system that does not appear
to be doing anything malicious, nor do the classes expose the private key in any
variables that could be accessed elsewhere (such as in the global scope). As
long as we create and use the clients in a limited scope (such as inside a setup
function) and don't maintain references to them after initial private key
retrieval, we should be safe.

The main threat vectors are (1) malicious browser extensions and (2) XSS
attacks:

1. Browser extensions are pretty limited in their ability to access data on the
   page, but if given permission, they can access the browser's DOM and a tab's
   URL. They cannot access the browser's JS variables/memory or storage, so they
   cannot access the private key nor Web3Auth's session tokens. We never put the
   private key in the DOM, and we use the **popup** auth flow because the
   (default) **redirect** auth flow returns the private key in the URL hash,
   which an extension could read.
2. XSS attacks are more dangerous since they run in the page's JS context, which
   is where all the authentication happens. This means they can access local
   storage and any exposed variables/memory. This is why we must be very careful
   about how we handle the private key.

### Private key handling

The Web3Auth client is created in a `setup` function that is called only when a
connection attempt begins, which is requested by the user (or potentially
automatically on initial page load if previously connected). The private key is
retrieved after successful authentication within this same function. Then, a
[Web
Worker](https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Using_web_workers)
is spawned to handle all subsequent signing requests. Web workers are isolated
from the main JS thread, so the main thread cannot access the worker's thread
and vice versa. The two threads (main and worker) are isolated from each other
similar to how browser extensions are isolated from the main page, which is why
we want to give the worker the responsibility of holding onto the private key
and signing transactions.

Since XSS attacks can access the main thread's memory, they could compromise the
communication channel
([`postMessage`](https://developer.mozilla.org/en-US/docs/Web/API/Worker/postMessage))
between the main and worker threads by overriding the Worker prototype. Because
of this, we must treat the channel as untrusted, encrypting sensitive data (the
wallet private key) and proving we are really the ones asking for a message to
be signed. To protect against this, a reference to
`Worker.prototype.postMessage` is stored at the top of the file so that it is
saved when the code is imported, hopefully grabbing a reference before an
attacker is able to overwrite it with a malicious implementation. This may or
may not be reliable, depending on the other in which code gets executed and the
nature of the specific XSS attack, but it should help. On top of this,
encryption is used over this communication channel, described below.

Both the main and worker threads create their own elliptic curve (secp256k1)
private/public keypair to communicate with each other, and they perform a
handshake. The handshake delivers each thread's public key to the other, so they
can encrypt/decrypt and sign/verify messages between themselves. The handshake
goes like this:

- The main thread creates a private/public keypair and sends the public key to
  the worker.
- The worker creates a private/public keypair and sends the public key to the
  main thread, encrypted with the client's public key.
- The main thread decrypts the worker's public key and sends the wallet private
  key encrypted with the worker's public key.
- The worker decrypts the wallet private key.

Once the handshake is complete, the `setup` function ends, and only references
to the worker, the client's private key, and the worker's public key are kept in
the main thread as [private
variables](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Classes/Private_class_fields)
(inaccessible to any other code except inside the client's methods). The
Web3Auth authentication client and wallet private key are no longer referenced
in the main thread, so they can be garbage collected. One reference exists to
the wallet private key in the worker thread, where it's safe and is used to sign
messages requested by the main thread.

When signing a message, the public keys are used to sign/verify both the sign
request and the signed response. That process goes like this:

- The main thread signs the message request (plus a nonce) and sends the message
  to sign, the nonce, and the signature to the worker.
- The worker verifies the signature and signs the message with the wallet
  private key. It then sends the signed message and a signature back to the main
  thread.
- The main thread verifies the signature and forwards the signed message to the
  caller (likely to be broadcast to the blockchain).

When disconnecting the wallet, the Web3Auth client is recreated (as it only
lived for the duration of the `setup` function previously) so its `logout`
function can be called. This will remove the Web3Auth session tokens from local
storage, and the worker thread will be terminated right after. If the Web3Auth
client fails to automatically log in, it is assumed to be because the session
expired or its tokens no longer exist in local storage, so nothing happens as
the user is already logged out.

#### Summary

The Web3Auth client only exists for the short time its needed to retrieve the
private key or logout of the session. The private key is immediately transmitted
to the worker thread and then unreferenced by the main thread so it can be
garbage collected, just like the Web3Auth client. The worker thread acts as an
isolated environment to handle signing requests, and the two threads communicate
via encrypted or signed messages (using elliptic curve secp256k1 keys) to ensure
a compromised communication channel cannot be used to steal the private key or
sign arbitrary messages.

### Philosophy

This security is based heavily on Defense in Depth, which is the security
principle that states that a system should have several independent layers of
security, providing redundancy in case of unexpected failure. We don't *need* to
authenticate the communications between the client and the worker, because if JS
variables truly are private within closures, the original reference to
`Worker.prototype.postMessage` should be safe. However, if that reference is
compromised, we want to make it harder for the attacker to simply MITM the
communication channel by setting up an authentication scheme. If the attacker
compromises the `postMessage` implementation from the very beginning, there's
not much we can do, other than force the XSS attack to depend on a lot of
libraries and code to succeed, which would make it that much harder to inject.

The safety of all this, the assumptions that are being made, heavily depend on
the JS VM being used, which is out of our control. In this security context,
layering security is the best we can do, and we can only hope that there are no
major flaws outside of our control.

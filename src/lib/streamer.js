/* eslint-disable no-underscore-dangle , promise/prefer-await-to-callbacks,  */
// @ts-check
const { Buffer } = require('buffer')
const http = require('http')
const https = require('https')
const { PassThrough } = require('stream')

class StreamingResponse extends PassThrough {
  statusCode = 200

  /** @type {Map<string | number | readonly string[]>} */
  _clientHeaders
  _metadataSent = false
  outgoingMessage

  constructor(url) {
    super()
    // eslint-disable-next-line node/no-unsupported-features/node-builtins
    const parsedUrl = new URL(url)
    this.outgoingMessage = parsedUrl.protocol === 'https:' ? https.request(url) : http.request(url)
    this.pipe(this.outgoingMessage)
  }

  setHeader(name, value) {
    if (!this._clientHeaders) {
      this._clientHeaders = new Map()
    }
    this._clientHeaders.set(name, value)
    return this
  }

  _getMetadata() {
    return JSON.stringify({
      // eslint-disable-next-line node/no-unsupported-features/es-builtins
      headers: Object.fromEntries(this._clientHeaders.entries()),
      statusCode: this.statusCode,
    })
  }

  write(data, encoding, callback) {
    if (!this._metadataSent) {
      super.write(this._getMetadata())
      super.write(Buffer.from([0x00]))
      this._metadataSent = true
    }
    return super.write(data, encoding, callback)
  }
}

/**
 *
 * @param {import("./streamer").StreamingHandler} handler
 * @returns {import("../function/handler").Handler}
 */
const wrapHandler =
  (handler) =>
  /**
   * @returns {import("../function/response").Response | Promise<import("../function/response").Response>}
   */
  (event, context, callback) => {
    const requestId = event.headers['x-nf-request-id']
    if (!requestId) {
      return {
        statusCode: 422,
        body: 'Missing request id',
      }
    }
    const callbackUrl = `https://ntl-functions-streaming.herokuapp.com/.stream/${requestId}`

    /** @type {StreamingResponse} */
    let res

    try {
      res = new StreamingResponse(callbackUrl)
    } catch (error) {
      console.error(error)
      return {
        statusCode: 500,
        body: 'Internal Server Error',
      }
    }

    return new Promise((resolve) => {
      res.on('error', (error) => {
        console.error(error)
        resolve({
          statusCode: 500,
          body: 'Internal Server Error',
        })
      })

      res.on('finish', () =>
        resolve({
          statusCode: 200,
          body: 'OK',
        }),
      )
      /* eslint-disable promise/prefer-await-to-then, promise/always-return */

      const result = handler(event, res, context, callback)

      if (result) {
        result
          .then(() => {
            res.end()
            resolve({
              statusCode: 200,
              body: 'OK',
            })
          })
          .catch((error) => {
            console.error(error)
            resolve({
              statusCode: 500,
              body: 'Internal Server Error',
            })
          })
      } else {
        res.end()
        resolve({
          statusCode: 200,
          body: 'OK',
        })
      }
      /* eslint-enable  promise/prefer-await-to-then, promise/always-return */
    })
  }

module.exports.streamer = wrapHandler
/* eslint-enable no-underscore-dangle, promise/prefer-await-to-callbacks, */

import { Buffer } from 'buffer'
import { request } from 'https'
import { env } from 'process'

const siteId = env.SITE_ID

const GRAPH_HOST = 'graph.netlify.com'

export const graphRequest = function (secretToken: string, requestBody: Uint8Array): Promise<string> {
  return new Promise((resolve, reject) => {
    const port = 443

    const options = {
      host: GRAPH_HOST,
      path: `/graphql?app_id=${siteId}`,
      port,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secretToken}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'Content-Length': requestBody ? Buffer.byteLength(requestBody) : 0,
      },
    }

    const req = request(options, (res) => {
      if (res.statusCode !== 200) {
        return reject(new Error(String(res.statusCode)))
      }

      const body: Array<Uint8Array> = []

      res.on('data', (chunk) => {
        body.push(chunk)
      })

      res.on('end', () => {
        const data = Buffer.concat(body).toString()
        try {
          resolve(data)
        } catch (error) {
          reject(error)
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.write(requestBody)

    req.end()
  })
}

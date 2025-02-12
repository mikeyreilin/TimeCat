import { RecorderOptions } from '@timecat/share'
import { download, isDev } from './tools/common'

function encodePCM(bufferData: Float32Array, opts: RecorderOptions) {
    const { sampleBits } = opts
    const isLittleEndian = true
    const length = bufferData.length * (opts.sampleBits / 8)
    const data = new DataView(new ArrayBuffer(length))
    let offset = 0

    if (sampleBits === 8) {
        for (let i = 0; i < bufferData.length; i++, offset++) {
            let s = Math.max(-1, Math.min(1, bufferData[i]))
            let val = s < 0 ? s * 128 : s * 127
            val = +val + 128
            data.setInt8(offset, val)
        }
    } else {
        for (let i = 0; i < bufferData.length; i++, offset += 2) {
            let s = Math.max(-1, Math.min(1, bufferData[i]))
            data.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, isLittleEndian)
        }
    }

    return data
}

export function encodeWAV(data: Float32Array[], opts: RecorderOptions) {
    const PMC = encodePCM(mergeArray(data), opts)
    const arrayBuffer = createWavFile(PMC, opts)

    let blob = new Blob([arrayBuffer], {
        type: 'audio/wav'
    })

    if (isDev) {
        ;(window as any).downloadWAV = () => download(blob, 'test-wav.wav')
    }

    return blob
}

function mergeArray(list: Float32Array[]) {
    let length = list.length * list[0].length
    let data = new Float32Array(length),
        offset = 0
    for (let i = 0; i < list.length; i++) {
        data.set(list[i], offset)
        offset += list[i].length
    }
    return data
}

function createWavFile(audioData: DataView, { channelCount, sampleBits, sampleRate }: RecorderOptions) {
    const WAV_HEAD_SIZE = 44
    let buffer = new ArrayBuffer(WAV_HEAD_SIZE + audioData.byteLength)
    const isLittleEndian = true
    // control buffer
    const view = new DataView(buffer)
    // write head
    // RIFF chunk descriptor/identifier
    writeUTFBytes(view, 0, 'RIFF')
    // RIFF chunk length
    view.setUint32(4, 36 + audioData.byteLength * 2, isLittleEndian)
    // RIFF type
    writeUTFBytes(view, 8, 'WAVE')
    // format chunk identifier
    // FMT sub-chunk
    writeUTFBytes(view, 12, 'fmt ')
    // format chunk length
    view.setUint32(16, 16, isLittleEndian)
    // sample format (raw)
    view.setUint16(20, 1, isLittleEndian)
    // stereo (channels)
    view.setUint16(22, channelCount, isLittleEndian)
    // sample rate
    view.setUint32(24, sampleRate, isLittleEndian)
    // byte rate (sample rate * block align)
    view.setUint32(28, sampleRate * channelCount * (sampleBits / 8), isLittleEndian)
    // block align (channel count * bytes per sample)
    view.setUint16(32, channelCount * (sampleBits / 8), isLittleEndian)
    // bits per sample
    view.setUint16(34, sampleBits, isLittleEndian)
    // data sub-chunk
    // data chunk identifier
    writeUTFBytes(view, 36, 'data')
    // data chunk length
    view.setUint32(40, audioData.byteLength, isLittleEndian)
    // view.setUint32(40, audioData.length * 2, isLittleEndian)

    // write PCM
    let length = audioData.byteLength
    let offset = 44
    // let volume = 1
    for (let i = 0; i < length; i++) {
        view.setUint8(offset, audioData.getUint8(i)) // * (0x7fff * volume)
        offset++
        // offset += 2
    }

    return view
}

function writeUTFBytes(view: DataView, offset: number, string: string) {
    var lng = string.length
    for (var i = 0; i < lng; i++) {
        view.setUint8(offset + i, string.charCodeAt(i))
    }
}

export function float32ArrayToBase64(data: Float32Array) {
    // Convert F32 to Uint8
    const uint = new Uint8Array(data.buffer)

    // Convert Uint8 to Base64
    const str = btoa(String.fromCharCode.apply(null, uint))
    return str
}

export function base64ToFloat32Array(str: string) {
    const blob = atob(str)
    const bLength = blob.length
    const arrayBuffer = new ArrayBuffer(bLength)
    const dataView = new DataView(arrayBuffer)
    for (let i = 0; i < bLength; i++) {
        dataView.setUint8(i, blob.charCodeAt(i))
    }

    return new Float32Array(arrayBuffer)
}

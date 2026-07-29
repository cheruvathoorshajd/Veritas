// Captures mono Float32 frames from the mic and posts them to the main thread.
// Main-thread code resamples to 16 kHz and converts to PCM16.
class MicPcmProcessor extends AudioWorkletProcessor {
  process(inputs) {
    const input = inputs[0]
    if (!input || input.length === 0) return true
    const channel = input[0]
    if (!channel || channel.length === 0) return true
    // Copy because the underlying buffer is reused.
    this.port.postMessage(new Float32Array(channel))
    return true
  }
}

registerProcessor('mic-pcm-processor', MicPcmProcessor)

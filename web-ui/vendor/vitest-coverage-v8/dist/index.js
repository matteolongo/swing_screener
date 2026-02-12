const mod = {
  async startCoverage() {
    // no-op in compatibility mode
  },
  async takeCoverage() {
    return { result: [] }
  },
  async stopCoverage() {
    // no-op in compatibility mode
  },
  async getProvider() {
    const provider = await import('./provider.js')
    return provider.getProvider()
  },
}

export default mod

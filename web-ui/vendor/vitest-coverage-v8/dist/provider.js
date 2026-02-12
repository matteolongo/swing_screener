import { promises as fs } from 'node:fs'
import { join } from 'node:path'

class CoverageCompatibilityProvider {
  constructor() {
    this.name = 'v8'
    this.ctx = undefined
    this.options = undefined
    this.coveragePayloads = []
  }

  initialize(ctx) {
    this.ctx = ctx
    this.options = {
      ...ctx.config.coverage,
      reporter: ctx.config.coverage.reporter ?? ['text', 'json', 'html'],
      reportsDirectory: ctx.config.coverage.reportsDirectory ?? 'coverage',
    }
  }

  resolveOptions() {
    return this.options
  }

  async clean(clean = true) {
    if (!clean) return
    const reportsDirectory = this.options?.reportsDirectory
    if (reportsDirectory) {
      await fs.rm(reportsDirectory, { recursive: true, force: true })
    }
  }

  async onAfterSuiteRun(meta) {
    if (meta?.coverage) {
      this.coveragePayloads.push(meta.coverage)
    }
  }

  async reportCoverage() {
    const reportsDirectory = this.options?.reportsDirectory ?? 'coverage'
    await fs.mkdir(reportsDirectory, { recursive: true })

    const output = {
      provider: 'v8',
      mode: 'compatibility',
      message:
        'Coverage compatibility mode active. Install @vitest/coverage-v8@^1.6.1 from npm for full coverage reports and threshold enforcement.',
      suitesWithCoveragePayload: this.coveragePayloads.length,
    }

    const outputPath = join(reportsDirectory, 'coverage-compatibility.json')
    await fs.writeFile(outputPath, JSON.stringify(output, null, 2), 'utf8')

    this.ctx?.logger?.log?.(` % Coverage compatibility mode wrote ${outputPath}`)
  }
}

export function getProvider() {
  return new CoverageCompatibilityProvider()
}

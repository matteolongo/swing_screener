# Web UI Architecture

> Status: current.  
> Last reviewed: 2026-02-17.

## Structure
- Pages: `web-ui/src/pages/`
- Domain components: `web-ui/src/components/domain/`
- Common UI: `web-ui/src/components/common/`
- API hooks: `web-ui/src/features/`
- Type transforms: `web-ui/src/types/`
- Shared query keys/invalidation: `web-ui/src/lib/`

## Contracts
- API payloads remain snake_case at the boundary and are transformed in `web-ui/src/types/`.
- React Query keys live in `web-ui/src/lib/queryKeys.ts`.

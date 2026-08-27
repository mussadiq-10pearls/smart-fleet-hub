# Graph Report - smart-fleet-hub  (2026-08-22)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 221 nodes · 256 edges · 22 communities (19 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `99b58428`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- script.js
- @types/node
- @aws-sdk/client-dynamodb
- data-simulator/package.json
- groq-test/package.json
- auth.js
- alerts-persister/package.json
- compilerOptions
- compilerOptions
- query-api/package.json
- compilerOptions
- safety-scorer/package.json
- compilerOptions
- telemetry-processor/package.json
- compilerOptions
- safety-scorer/index.ts
- telemetry-processor/index.ts
- data-simulator/index.ts
- alerts-persister.ts
- alerts-persister/index.ts
- query-api/index.ts

## God Nodes (most connected - your core abstractions)
1. `refreshData()` - 9 edges
2. `compilerOptions` - 8 edges
3. `compilerOptions` - 8 edges
4. `compilerOptions` - 8 edges
5. `compilerOptions` - 8 edges
6. `compilerOptions` - 8 edges
7. `fetchTelemetry()` - 7 edges
8. `startDashboard()` - 6 edges
9. `getAuthHeaders()` - 5 edges
10. `sortData()` - 5 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (22 total, 3 thin omitted)

### Community 0 - "script.js"
Cohesion: 0.18
Nodes (22): allTelemetryData, askQuestion(), clearAutoRefresh(), currentSort, fetchTelemetry(), getAuthHeaders(), init(), loadVehicles() (+14 more)

### Community 1 - "@types/node"
Cohesion: 0.12
Nodes (22): devDependencies, @types/aws-lambda, @types/node, typescript, devDependencies, @types/node, typescript, devDependencies (+14 more)

### Community 2 - "@aws-sdk/client-dynamodb"
Cohesion: 0.15
Nodes (16): @aws-sdk/client-sns, dependencies, @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, dependencies, @aws-sdk/client-dynamodb, @aws-sdk/lib-dynamodb, @aws-sdk/client-dynamodb (+8 more)

### Community 3 - "data-simulator/package.json"
Cohesion: 0.15
Nodes (12): @aws-sdk/client-sqs, author, dependencies, @aws-sdk/client-sqs, description, keywords, license, main (+4 more)

### Community 4 - "groq-test/package.json"
Cohesion: 0.15
Nodes (12): dotenv, author, dependencies, dotenv, description, keywords, license, main (+4 more)

### Community 5 - "auth.js"
Cohesion: 0.33
Nodes (9): base64URLEncode(), generateCodeChallenge(), generateCodeVerifier(), getStoredTokens(), handleAuthCallback(), isTokenValid(), login(), refreshAccessToken() (+1 more)

### Community 6 - "alerts-persister/package.json"
Cohesion: 0.20
Nodes (9): author, description, keywords, license, main, name, scripts, test (+1 more)

### Community 7 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, module, outDir, rootDir, strict, target, types (+1 more)

### Community 8 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, module, outDir, rootDir, strict, target, types (+1 more)

### Community 9 - "query-api/package.json"
Cohesion: 0.20
Nodes (9): author, description, keywords, license, main, name, scripts, test (+1 more)

### Community 10 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, module, outDir, rootDir, strict, target, types (+1 more)

### Community 11 - "safety-scorer/package.json"
Cohesion: 0.20
Nodes (9): author, description, keywords, license, main, name, scripts, test (+1 more)

### Community 12 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, module, outDir, rootDir, strict, target, types (+1 more)

### Community 13 - "telemetry-processor/package.json"
Cohesion: 0.20
Nodes (9): author, description, keywords, license, main, name, scripts, test (+1 more)

### Community 14 - "compilerOptions"
Cohesion: 0.20
Nodes (9): compilerOptions, esModuleInterop, module, outDir, rootDir, strict, target, types (+1 more)

### Community 15 - "safety-scorer/index.ts"
Cohesion: 0.36
Nodes (7): calculateRuleBasedScore(), ddbClient, docClient, getAIScore(), getTelemetryForVehicle(), handler(), TelemetryItem

### Community 16 - "telemetry-processor/index.ts"
Cohesion: 0.33
Nodes (4): ddbClient, docClient, sns, TelemetryEvent

### Community 17 - "data-simulator/index.ts"
Cohesion: 0.50
Nodes (4): generateTelemetry(), handler(), sqs, VEHICLE_IDS

## Knowledge Gaps
- **103 isolated node(s):** `TelemetryItem`, `TelemetryEvent`, `allTelemetryData`, `currentSort`, `esModuleInterop` (+98 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `@types/node` to `data-simulator/package.json`?**
  _High betweenness centrality (0.042) - this node is a cross-community bridge._
- **What connects `TelemetryItem`, `TelemetryEvent`, `allTelemetryData` to the rest of the system?**
  _103 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `@types/node` be split into smaller, more focused modules?**
  _Cohesion score 0.12121212121212122 - nodes in this community are weakly interconnected._
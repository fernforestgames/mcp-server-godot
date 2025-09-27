# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript MCP (Model Context Protocol) server for Godot game engine integration. The server implements the MCP specification to provide tools that can interact with Godot projects through the MCP protocol.

## Essential Commands

**Development:**
```bash
npm run dev          # Watch mode compilation
npm run build        # Compile TypeScript to dist/
npm run start        # Run compiled server
```

**Quality Assurance:**
```bash
npm run lint         # ESLint with TypeScript support
npm test             # Jest testing
```

**All commands run automatically in CI via GitHub Actions on pushes to main.**

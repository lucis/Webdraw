/**
 * Tools do sistema para metadados e descoberta.
 * 
 * Este arquivo contém tools relacionadas ao sistema, incluindo:
 * - Descoberta de tools disponíveis
 * - Metadados do workspace
 * - Informações de integração
 */

import { createTool } from "@deco/workers-runtime/mastra";
import { z } from "zod";
import type { Env } from "../main.ts";

/**
 * Tool: LIST_AVAILABLE_TOOLS
 * 
 * Lista todas as tools MCP disponíveis no workspace com seus metadados.
 */
export const createListAvailableToolsTool = (_env: Env) =>
  createTool({
    id: "LIST_AVAILABLE_TOOLS",
    description: "Lista todas as tools MCP disponíveis no workspace com metadados",
    
    inputSchema: z.object({
      category: z.string().optional(),
      search: z.string().optional(),
      includeDetails: z.boolean().default(true),
    }),
    
    outputSchema: z.object({
      tools: z.array(z.object({
        id: z.string(),
        name: z.string(),
        description: z.string(),
        category: z.string().optional(),
        appName: z.string().optional(), // Nome do app/MCP
        mcpName: z.string().optional(), // Nome do MCP se diferente do app
        integration: z.string(), // Nome da integração (e.g., "AI_GATEWAY", "DATABASE")
        inputSchema: z.record(z.any()).optional(),
        outputSchema: z.record(z.any()).optional(),
        scopes: z.array(z.string()).optional(), // Scopes necessários
      })),
      totalTools: z.number(),
      categories: z.array(z.string()),
    }),
    
    execute: async ({ context }) => {
      const { category, search, includeDetails } = context;
      
      // Lista de tools conhecidas com seus metadados
      // TODO: Implementar discovery automático via reflection/metadata do Env
      const availableTools = [
        // AI Gateway Tools
        {
          id: "AI_GENERATE",
          name: "Generate Text",
          description: "Generate text using AI models",
          category: "AI",
          appName: "AI Gateway",
          mcpName: "AI_GATEWAY",
          integration: "AI_GATEWAY",
          scopes: ["AI_GATEWAY::AI_GENERATE"],
          inputSchema: includeDetails ? {
            message: { type: "string", required: true },
            model: { type: "string", required: false },
            temperature: { type: "number", required: false },
          } : undefined,
          outputSchema: includeDetails ? {
            text: { type: "string" },
            usage: { type: "object" },
          } : undefined,
        },
        {
          id: "AI_GENERATE_OBJECT",
          name: "Generate Structured Object",
          description: "Generate structured objects using AI with JSON schema validation",
          category: "AI",
          appName: "AI Gateway",
          mcpName: "AI_GATEWAY", 
          integration: "AI_GATEWAY",
          scopes: ["AI_GATEWAY::AI_GENERATE_OBJECT"],
          inputSchema: includeDetails ? {
            messages: { type: "array", required: true },
            schema: { type: "object", required: true },
            model: { type: "string", required: false },
          } : undefined,
          outputSchema: includeDetails ? {
            object: { type: "object" },
            usage: { type: "object" },
          } : undefined,
        },
        
        // Database Tools
        {
          id: "DATABASES_RUN_SQL",
          name: "Run SQL Query",
          description: "Execute SQL queries against the workspace database",
          category: "Database",
          appName: "Database",
          mcpName: "DATABASE",
          integration: "DATABASE",
          scopes: ["DATABASE::DATABASES_RUN_SQL"],
          inputSchema: includeDetails ? {
            sql: { type: "string", required: true },
            params: { type: "array", required: false },
          } : undefined,
          outputSchema: includeDetails ? {
            results: { type: "array" },
            rowCount: { type: "number" },
          } : undefined,
        },
        
        // DECONFIG Tools
        {
          id: "DECONFIG_READ_FILE",
          name: "Read File",
          description: "Read file from DECONFIG storage",
          category: "Storage",
          appName: "DECONFIG",
          mcpName: "DECONFIG",
          integration: "DECONFIG",
          scopes: ["DECONFIG::READ_FILE"],
          inputSchema: includeDetails ? {
            branch: { type: "string", required: true },
            path: { type: "string", required: true },
            format: { type: "string", required: false },
          } : undefined,
          outputSchema: includeDetails ? {
            content: { type: "string" },
            metadata: { type: "object" },
          } : undefined,
        },
        {
          id: "DECONFIG_PUT_FILE",
          name: "Write File",
          description: "Write file to DECONFIG storage",
          category: "Storage",
          appName: "DECONFIG",
          mcpName: "DECONFIG",
          integration: "DECONFIG",
          scopes: ["DECONFIG::PUT_FILE"],
          inputSchema: includeDetails ? {
            branch: { type: "string", required: true },
            path: { type: "string", required: true },
            content: { type: "string", required: true },
            metadata: { type: "object", required: false },
          } : undefined,
          outputSchema: includeDetails ? {
            success: { type: "boolean" },
          } : undefined,
        },
        {
          id: "DECONFIG_LIST_FILES",
          name: "List Files",
          description: "List files in DECONFIG storage",
          category: "Storage",
          appName: "DECONFIG",
          mcpName: "DECONFIG",
          integration: "DECONFIG",
          scopes: ["DECONFIG::LIST_FILES"],
          inputSchema: includeDetails ? {
            branch: { type: "string", required: true },
            path: { type: "string", required: false },
          } : undefined,
          outputSchema: includeDetails ? {
            files: { type: "array" },
          } : undefined,
        },
        {
          id: "DECONFIG_DELETE_FILE",
          name: "Delete File",
          description: "Delete file from DECONFIG storage",
          category: "Storage",
          appName: "DECONFIG",
          mcpName: "DECONFIG",
          integration: "DECONFIG",
          scopes: ["DECONFIG::DELETE_FILE"],
          inputSchema: includeDetails ? {
            branch: { type: "string", required: true },
            path: { type: "string", required: true },
          } : undefined,
          outputSchema: includeDetails ? {
            success: { type: "boolean" },
          } : undefined,
        },
        
        // Registry Tools
        {
          id: "REGISTRY_LIST_APPS",
          name: "List Apps",
          description: "List available apps in the registry",
          category: "Registry",
          appName: "Registry",
          mcpName: "REGISTRY",
          integration: "REGISTRY",
          scopes: ["REGISTRY::REGISTRY_LIST_APPS"],
          inputSchema: includeDetails ? {
            search: { type: "string", required: false },
            scopeName: { type: "string", required: false },
          } : undefined,
          outputSchema: includeDetails ? {
            apps: { type: "array" },
          } : undefined,
        },
        {
          id: "REGISTRY_LIST_SCOPES",
          name: "List Scopes",
          description: "List available scopes in the registry",
          category: "Registry",
          appName: "Registry",
          mcpName: "REGISTRY",
          integration: "REGISTRY",
          scopes: ["REGISTRY::REGISTRY_LIST_SCOPES"],
          inputSchema: includeDetails ? {} : undefined,
          outputSchema: includeDetails ? {
            scopes: { type: "array" },
          } : undefined,
        },
        
        // Webdraw Tools (nossas próprias tools)
        {
          id: "CREATE_DRAWING",
          name: "Create Drawing",
          description: "Create a new Excalidraw drawing",
          category: "Webdraw",
          appName: "Webdraw",
          mcpName: "SELF",
          integration: "SELF",
          scopes: [],
          inputSchema: includeDetails ? {
            name: { type: "string", required: true },
            description: { type: "string", required: false },
            folderId: { type: "string", required: false },
            elements: { type: "array", required: false },
          } : undefined,
          outputSchema: includeDetails ? {
            drawing: { type: "object" },
          } : undefined,
        },
        {
          id: "GET_DRAWING",
          name: "Get Drawing",
          description: "Get a specific drawing by ID",
          category: "Webdraw",
          appName: "Webdraw",
          mcpName: "SELF",
          integration: "SELF",
          scopes: [],
          inputSchema: includeDetails ? {
            drawingId: { type: "string", required: true },
            branch: { type: "string", required: false },
          } : undefined,
          outputSchema: includeDetails ? {
            drawing: { type: "object" },
          } : undefined,
        },
        {
          id: "LIST_DRAWINGS",
          name: "List Drawings",
          description: "List drawings in a folder",
          category: "Webdraw",
          appName: "Webdraw",
          mcpName: "SELF",
          integration: "SELF",
          scopes: [],
          inputSchema: includeDetails ? {
            folderId: { type: "string", required: false },
            branch: { type: "string", required: false },
          } : undefined,
          outputSchema: includeDetails ? {
            drawings: { type: "array" },
          } : undefined,
        },
        {
          id: "UPDATE_DRAWING",
          name: "Update Drawing",
          description: "Update an existing drawing",
          category: "Webdraw",
          appName: "Webdraw",
          mcpName: "SELF",
          integration: "SELF",
          scopes: [],
          inputSchema: includeDetails ? {
            drawingId: { type: "string", required: true },
            elements: { type: "array", required: false },
            appState: { type: "object", required: false },
          } : undefined,
          outputSchema: includeDetails ? {
            drawing: { type: "object" },
          } : undefined,
        },
        {
          id: "CREATE_FOLDER",
          name: "Create Folder",
          description: "Create a new folder",
          category: "Webdraw",
          appName: "Webdraw",
          mcpName: "SELF",
          integration: "SELF",
          scopes: [],
          inputSchema: includeDetails ? {
            name: { type: "string", required: true },
            emoji: { type: "string", required: true },
            branch: { type: "string", required: false },
          } : undefined,
          outputSchema: includeDetails ? {
            folder: { type: "object" },
          } : undefined,
        },
        {
          id: "LIST_FOLDERS",
          name: "List Folders",
          description: "List all folders",
          category: "Webdraw",
          appName: "Webdraw",
          mcpName: "SELF",
          integration: "SELF",
          scopes: [],
          inputSchema: includeDetails ? {
            branch: { type: "string", required: false },
          } : undefined,
          outputSchema: includeDetails ? {
            folders: { type: "array" },
          } : undefined,
        },
      ];
      
      // Aplicar filtros
      let filteredTools = availableTools;
      
      if (category) {
        filteredTools = filteredTools.filter(tool => 
          tool.category?.toLowerCase() === category.toLowerCase()
        );
      }
      
      if (search) {
        const searchLower = search.toLowerCase();
        filteredTools = filteredTools.filter(tool => 
          tool.name.toLowerCase().includes(searchLower) ||
          tool.description.toLowerCase().includes(searchLower) ||
          tool.id.toLowerCase().includes(searchLower)
        );
      }
      
      // Extrair categorias únicas
      const categories = [...new Set(availableTools.map(tool => tool.category).filter(Boolean))].sort();
      
      return {
        tools: filteredTools,
        totalTools: filteredTools.length,
        categories,
      };
    },
  });

/**
 * Exportar todas as tools do sistema
 */
export const systemTools = [
  createListAvailableToolsTool,
];

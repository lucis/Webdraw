import { createRoute, type RootRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "../components/ui/button";
import { client } from "../lib/rpc";

/**
 * Debug Tools - UI rough para testar todas as tools do webdraw
 * 
 * Esta página fornece uma interface básica para testar as tools de
 * folders e drawings diretamente do frontend, sem precisar usar o MCP.
 */
function DebugToolsComponent() {
  const [output, setOutput] = useState<string>("");
  const [loading, setLoading] = useState(false);

  // Branch atual
  const [branch] = useState("main");

  // Estado para criar folder
  const [folderName, setFolderName] = useState("");
  const [folderEmoji, setFolderEmoji] = useState("📁");

  // Estado para folders listados
  const [folders, setFolders] = useState<any[]>([]);
  const [selectedFolder, setSelectedFolder] = useState<string | null>(null);

  // Estado para criar drawing
  const [drawingName, setDrawingName] = useState("");
  const [drawingDescription, setDrawingDescription] = useState("");

  // Estado para drawings listados
  const [drawings, setDrawings] = useState<any[]>([]);

  /**
   * Helper para executar tool e mostrar resultado
   */
  const executeTool = async (toolName: string, action: () => Promise<any>) => {
    setLoading(true);
    setOutput(`⏳ Executando ${toolName}...`);

    try {
      const result = await action();
      setOutput(`✅ ${toolName}\n\n${JSON.stringify(result, null, 2)}`);
      return result;
    } catch (error) {
      setOutput(`❌ Erro em ${toolName}\n\n${error}`);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  /**
   * FOLDERS TOOLS
   */

  const handleEnsureDefaultFolder = async () => {
    await executeTool("ENSURE_DEFAULT_FOLDER", async () => {
      const result = await client.ENSURE_DEFAULT_FOLDER({ branch });
      return result;
    });
  };

  const handleCreateFolder = async () => {
    if (!folderName) {
      alert("Digite um nome para o folder");
      return;
    }

    await executeTool("CREATE_FOLDER", async () => {
      const result = await client.CREATE_FOLDER({
        name: folderName,
        emoji: folderEmoji,
        branch,
      });
      setFolderName("");
      return result;
    });
  };

  const handleListFolders = async () => {
    await executeTool("LIST_FOLDERS", async () => {
      const result = await client.LIST_FOLDERS({ branch });
      setFolders(result.folders || []);
      return result;
    });
  };

  const handleUpdateFolder = async (folderId: string) => {
    const newName = prompt("Novo nome do folder:");
    if (!newName) return;

    await executeTool("UPDATE_FOLDER", async () => {
      const result = await client.UPDATE_FOLDER({
        folderId,
        name: newName,
        branch,
      });
      handleListFolders(); // Refresh
      return result;
    });
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (!confirm("Tem certeza que deseja deletar este folder?")) return;

    await executeTool("DELETE_FOLDER", async () => {
      const result = await client.DELETE_FOLDER({ folderId, branch });
      handleListFolders(); // Refresh
      return result;
    });
  };

  /**
   * DRAWINGS TOOLS
   */

  const handleCreateDrawing = async () => {
    if (!drawingName) {
      alert("Digite um nome para o drawing");
      return;
    }

    await executeTool("CREATE_DRAWING", async () => {
      const result = await client.CREATE_DRAWING({
        name: drawingName,
        description: drawingDescription,
        folderId: selectedFolder,
        branch,
      });
      setDrawingName("");
      setDrawingDescription("");
      return result;
    });
  };

  const handleListDrawings = async () => {
    await executeTool("LIST_DRAWINGS", async () => {
      const result = await client.LIST_DRAWINGS({
        folderId: selectedFolder,
        branch,
      });
      setDrawings(result.drawings || []);
      return result;
    });
  };

  const handleDeleteDrawing = async (drawingId: string) => {
    if (!confirm("Tem certeza que deseja deletar este drawing?")) return;

    await executeTool("DELETE_DRAWING", async () => {
      const result = await client.DELETE_DRAWING({ drawingId, branch });
      handleListDrawings(); // Refresh
      return result;
    });
  };

  const handleDuplicateDrawing = async (drawingId: string) => {
    await executeTool("DUPLICATE_DRAWING", async () => {
      const result = await client.DUPLICATE_DRAWING({ drawingId, branch });
      handleListDrawings(); // Refresh
      return result;
    });
  };

  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">🛠️ Debug Tools - Webdraw</h1>
          <p className="text-muted-foreground">
            UI rough para testar todas as tools de folders e drawings.
            <br />
            <strong>Importante:</strong> Execute <code className="bg-accent px-2 py-1 rounded">npm run gen:self</code> depois de startar o servidor para gerar os types.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* FOLDERS */}
          <div className="space-y-6">
            <div className="border rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">📁 Folders</h2>

              <div className="space-y-4">
                {/* Ensure Default Folder */}
                <div>
                  <h3 className="font-semibold mb-2">Ensure Default Folder</h3>
                  <Button
                    onClick={handleEnsureDefaultFolder}
                    disabled={loading}
                    className="w-full"
                  >
                    Garantir Folder Padrão
                  </Button>
                </div>

                {/* Create Folder */}
                <div>
                  <h3 className="font-semibold mb-2">Create Folder</h3>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Nome do folder"
                      value={folderName}
                      onChange={(e) => setFolderName(e.target.value)}
                      className="w-full px-3 py-2 border rounded"
                    />
                    <input
                      type="text"
                      placeholder="Emoji"
                      value={folderEmoji}
                      onChange={(e) => setFolderEmoji(e.target.value)}
                      className="w-full px-3 py-2 border rounded"
                      maxLength={2}
                    />
                    <Button
                      onClick={handleCreateFolder}
                      disabled={loading}
                      className="w-full"
                    >
                      Criar Folder
                    </Button>
                  </div>
                </div>

                {/* List Folders */}
                <div>
                  <h3 className="font-semibold mb-2">List Folders</h3>
                  <Button
                    onClick={handleListFolders}
                    disabled={loading}
                    variant="outline"
                    className="w-full mb-2"
                  >
                    Listar Folders
                  </Button>

                  {folders.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {folders.map((folder) => (
                        <div
                          key={folder.id}
                          className={`p-3 border rounded flex items-center justify-between cursor-pointer ${
                            selectedFolder === folder.id ? "bg-accent" : ""
                          }`}
                          onClick={() => setSelectedFolder(folder.id)}
                        >
                          <div>
                            <span className="mr-2">{folder.emoji}</span>
                            <span className="font-medium">{folder.name}</span>
                            {folder.isDefault && (
                              <span className="ml-2 text-xs text-muted-foreground">
                                (default)
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {!folder.isDefault && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleUpdateFolder(folder.id);
                                  }}
                                >
                                  ✏️
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteFolder(folder.id);
                                  }}
                                >
                                  🗑️
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* DRAWINGS */}
          <div className="space-y-6">
            <div className="border rounded-lg p-6">
              <h2 className="text-2xl font-bold mb-4">🎨 Drawings</h2>

              <div className="space-y-4">
                {/* Create Drawing */}
                <div>
                  <h3 className="font-semibold mb-2">Create Drawing</h3>
                  <div className="space-y-2">
                    <input
                      type="text"
                      placeholder="Nome do drawing"
                      value={drawingName}
                      onChange={(e) => setDrawingName(e.target.value)}
                      className="w-full px-3 py-2 border rounded"
                    />
                    <input
                      type="text"
                      placeholder="Descrição (opcional)"
                      value={drawingDescription}
                      onChange={(e) => setDrawingDescription(e.target.value)}
                      className="w-full px-3 py-2 border rounded"
                    />
                    <p className="text-xs text-muted-foreground">
                      Folder selecionado:{" "}
                      {selectedFolder || "Nenhum (selecione na lista)"}
                    </p>
                    <Button
                      onClick={handleCreateDrawing}
                      disabled={loading}
                      className="w-full"
                    >
                      Criar Drawing
                    </Button>
                  </div>
                </div>

                {/* List Drawings */}
                <div>
                  <h3 className="font-semibold mb-2">List Drawings</h3>
                  <Button
                    onClick={handleListDrawings}
                    disabled={loading}
                    variant="outline"
                    className="w-full mb-2"
                  >
                    Listar Drawings
                    {selectedFolder && " (do folder selecionado)"}
                  </Button>

                  {drawings.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {drawings.map((drawing) => (
                        <div
                          key={drawing.id}
                          className="p-3 border rounded flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">{drawing.name}</div>
                            {drawing.description && (
                              <div className="text-xs text-muted-foreground">
                                {drawing.description}
                              </div>
                            )}
                            <div className="text-xs text-muted-foreground mt-1">
                              {drawing.elementCount} elementos
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDuplicateDrawing(drawing.id)}
                            >
                              📋
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleDeleteDrawing(drawing.id)}
                            >
                              🗑️
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Output */}
        <div className="mt-8 border rounded-lg p-6">
          <h2 className="text-2xl font-bold mb-4">📋 Output</h2>
          <pre className="bg-accent p-4 rounded text-sm overflow-auto max-h-96 whitespace-pre-wrap">
            {output || "Nenhuma tool executada ainda..."}
          </pre>
        </div>

        {/* Instructions */}
        <div className="mt-8 border rounded-lg p-6 bg-accent/50">
          <h2 className="text-xl font-bold mb-4">📝 Como usar</h2>
          <ol className="list-decimal list-inside space-y-2">
            <li>
              <strong>Startar servidor:</strong>{" "}
              <code className="bg-background px-2 py-1 rounded">npm run dev</code>
            </li>
            <li>
              <strong>Copiar URL do dev</strong> que aparece nos logs (ex: https://localhost-xxxxx.deco.host/mcp)
            </li>
            <li>
              <strong>Gerar types:</strong>{" "}
              <code className="bg-background px-2 py-1 rounded">
                DECO_SELF_URL=&lt;url&gt; npm run gen:self
              </code>
            </li>
            <li>
              <strong>Descomentar as chamadas RPC</strong> neste arquivo (debug-tools.tsx)
            </li>
            <li>
              <strong>Testar as tools!</strong> Comece garantindo o folder default, depois crie folders e drawings.
            </li>
          </ol>
        </div>
      </div>
    </div>
  );
}

export default (parentRoute: RootRoute) =>
  createRoute({
    path: "/debug-tools",
    component: DebugToolsComponent,
    getParentRoute: () => parentRoute,
  });

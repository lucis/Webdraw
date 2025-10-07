/**
 * Seção de Resources - Cards draggable para o canvas
 * 
 * Lista resources vindos do backend que podem ser
 * arrastados para o canvas criando elementos especiais
 */

import { useState } from "react";
import { Package, Plus, Search, Grip } from "lucide-react";
import { Button } from "../ui/button";
import { cn } from "../../lib/utils";

// Tipos de Resource (placeholder - virão do backend)
interface Resource {
  id: string;
  title: string;
  description: string;
  type: "component" | "widget" | "template";
  icon?: string;
  thumbnail?: string;
  metadata?: Record<string, any>;
}

// Mock data - será substituído por dados reais do backend
const mockResources: Resource[] = [
  {
    id: "1",
    title: "Button Component",
    description: "Interactive button widget",
    type: "component",
    icon: "🔘",
    metadata: { category: "UI" }
  },
  {
    id: "2", 
    title: "Chart Widget",
    description: "Data visualization chart",
    type: "widget",
    icon: "📊",
    metadata: { category: "Data" }
  },
  {
    id: "3",
    title: "Form Template", 
    description: "Contact form template",
    type: "template",
    icon: "📝",
    metadata: { category: "Forms" }
  }
];

interface ResourceCardProps {
  resource: Resource;
  onDragStart: (resource: Resource) => void;
}

const ResourceCard = ({ resource, onDragStart }: ResourceCardProps) => {
  const [isDragging, setIsDragging] = useState(false);
  
  const handleDragStart = (e: React.DragEvent) => {
    setIsDragging(true);
    // Store resource data for drop
    e.dataTransfer.setData("application/json", JSON.stringify(resource));
    e.dataTransfer.effectAllowed = "copy";
    onDragStart(resource);
  };
  
  const handleDragEnd = () => {
    setIsDragging(false);
  };
  
  return (
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={cn(
        // Base styling
        "group relative p-3 rounded-lg border cursor-grab",
        "bg-slate-800 border-slate-600 hover:border-slate-500",
        "sidebar-item-hover resource-card",
        // Hover effects
        "hover:bg-slate-750 hover:shadow-md",
        // Dragging state
        isDragging && "opacity-50 scale-95 dragging-resource",
        // Focus state
        "focus:outline-none focus:ring-2 focus:ring-blue-500"
      )}
      tabIndex={0}
      role="button"
    >
      {/* Drag handle */}
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <Grip className="w-3 h-3 text-slate-500" />
      </div>
      
      {/* Content */}
      <div className="space-y-2">
        {/* Icon and title */}
        <div className="flex items-center gap-2">
          <span className="text-lg">{resource.icon}</span>
          <h4 className="text-sm font-medium text-slate-200 truncate">
            {resource.title}
          </h4>
        </div>
        
        {/* Description */}
        <p className="text-xs text-slate-400 line-clamp-2">
          {resource.description}
        </p>
        
        {/* Type badge */}
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-xs px-2 py-1 rounded-full",
            resource.type === "component" && "bg-blue-900/50 text-blue-300",
            resource.type === "widget" && "bg-green-900/50 text-green-300", 
            resource.type === "template" && "bg-purple-900/50 text-purple-300"
          )}>
            {resource.type}
          </span>
        </div>
      </div>
    </div>
  );
};

export const ResourcesSection = () => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  // Filter resources
  const filteredResources = mockResources.filter(resource => {
    const matchesSearch = resource.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         resource.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !selectedCategory || resource.metadata?.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });
  
  const categories = Array.from(new Set(mockResources.map(r => r.metadata?.category).filter(Boolean)));
  
  const handleDragStart = (resource: Resource) => {
    console.log("Started dragging resource:", resource);
    // TODO: Integrar com sistema de canvas/excalidraw
  };
  
  const handleRefreshResources = () => {
    // TODO: Recarregar resources do backend
    console.log("Refreshing resources...");
  };
  
  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-slate-400" />
          <h3 className="text-sm font-semibold text-slate-300">Resources</h3>
        </div>
        <Button
          size="sm"
          variant="ghost"
          className="h-6 w-6 p-0 hover:bg-slate-800"
          onClick={handleRefreshResources}
          title="Atualizar Resources"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>
      
      {/* Search */}
      <div className="px-3">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar resources..."
            className="w-full pl-7 pr-3 py-1.5 text-xs bg-slate-900 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
      
      {/* Category filters */}
      {categories.length > 0 && (
        <div className="px-3">
          <div className="flex flex-wrap gap-1">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "px-2 py-1 text-xs rounded-full transition-colors",
                !selectedCategory 
                  ? "bg-blue-600 text-white" 
                  : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              )}
            >
              Todos
            </button>
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={cn(
                  "px-2 py-1 text-xs rounded-full transition-colors",
                  selectedCategory === category
                    ? "bg-blue-600 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* Resources grid */}
      <div className="px-3 space-y-2 max-h-64 overflow-y-auto">
        {filteredResources.length === 0 ? (
          <div className="py-8 text-center">
            <Package className="w-8 h-8 mx-auto mb-2 text-slate-600" />
            <p className="text-sm text-slate-500">
              {searchQuery ? "Nenhum resource encontrado" : "Nenhum resource disponível"}
            </p>
            <Button
              size="sm"
              className="mt-2"
              onClick={handleRefreshResources}
            >
              Carregar Resources
            </Button>
          </div>
        ) : (
          filteredResources.map((resource) => (
            <ResourceCard
              key={resource.id}
              resource={resource}
              onDragStart={handleDragStart}
            />
          ))
        )}
      </div>
      
      {/* Footer info */}
      <div className="px-3 py-2 border-t border-slate-700">
        <p className="text-xs text-slate-500 text-center">
          Arraste os cards para o canvas
        </p>
      </div>
    </div>
  );
};

"use client"

import { useEffect, useRef, useState } from "react"

let cornerstone: any;
let dicomImageLoader: any;
let cornerstoneTools: any;

// Globální proměnné pro naše ulovené nástroje
let StackScrollTool: any;
let WindowLevelTool: any;
let primaryMouseButton: number = 1;
let wheelMouseButton: number = 524288; // 524288 je kód pro scrollovací kolečko v nové verzi knihovny

let isInitialized = false

export default function CornerstoneViewer({ files }: { files: File[] }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isReady, setIsReady] = useState(false)

  // 1. Inicializace enginu A HLEDÁNÍ NÁSTROJŮ
  useEffect(() => {
    const setupEngine = async () => {
      if (!isInitialized) {
        try {
          const coreModule: any = await import("@cornerstonejs/core")
          cornerstone = coreModule.default || coreModule

          const loaderModule: any = await import("@cornerstonejs/dicom-image-loader")
          dicomImageLoader = loaderModule.wadouri ? loaderModule : loaderModule.default

          const toolsModule: any = await import("@cornerstonejs/tools")
          cornerstoneTools = toolsModule.default || toolsModule

          // --- DYNAMICKÝ LOKÁTOR NÁSTROJŮ ---
          const allKeys = Object.keys(cornerstoneTools)
          
          // Nová verze ho přejmenovala na "StackScrollTool" (bez slova MouseWheel)
          const scrollKey = allKeys.find(k => k === "StackScrollTool") || allKeys.find(k => k.includes("StackScroll"))
          StackScrollTool = scrollKey ? cornerstoneTools[scrollKey] : null

          const wlKey = allKeys.find(k => k.includes("WindowLevel"))
          WindowLevelTool = wlKey ? cornerstoneTools[wlKey] : null

          // Bezpečná extrakce tlačítek myši
          const MouseBindings = cornerstoneTools.Enums?.MouseBindings || cornerstoneTools.default?.Enums?.MouseBindings
          primaryMouseButton = MouseBindings ? MouseBindings.Primary : 1
          wheelMouseButton = MouseBindings ? (MouseBindings.Wheel || 524288) : 524288

          if (!StackScrollTool || !WindowLevelTool) {
            console.error("KRITICKÁ CHYBA: Nástroje nenalezeny. Obsah knihovny:", allKeys)
            return
          }

          await cornerstone.init()
          await cornerstoneTools.init()
          
          dicomImageLoader.init({
            maxWebWorkers: navigator.hardwareConcurrency || 1,
          })

          cornerstoneTools.addTool(StackScrollTool)
          cornerstoneTools.addTool(WindowLevelTool)
          
          isInitialized = true
        } catch (error) {
          console.error("Chyba při startu Cornerstone:", error)
        }
      }
      setIsReady(true)
    }
    setupEngine()
  }, [])

  // 2. Renderování dat
  useEffect(() => {
    if (!isReady || !containerRef.current || files.length === 0) return

    const runRender = async () => {
      try {
        const renderingEngineId = "my_engine"
        let renderingEngine = cornerstone.getRenderingEngine(renderingEngineId)
        
        if (renderingEngine) {
          renderingEngine.destroy()
        }
        renderingEngine = new cornerstone.RenderingEngine(renderingEngineId)

        const imageIds = files.map((file: File) => {
          return dicomImageLoader.wadouri.fileManager.add(file)
        })

        const viewportId = "STACK_VIEWPORT"
        renderingEngine.setViewports([
          {
            viewportId,
            type: cornerstone.Enums.ViewportType.STACK,
            element: containerRef.current!,
          },
        ])

        const viewport = renderingEngine.getViewport(viewportId)
        await viewport.setStack(imageIds)
        renderingEngine.renderViewports([viewportId])

        // --- OVLÁDÁNÍ ---
        const toolGroupId = "my_tool_group"
        let toolGroup = cornerstoneTools.ToolGroupManager.getToolGroup(toolGroupId)
        if (toolGroup) {
          cornerstoneTools.ToolGroupManager.destroyToolGroup(toolGroupId)
        }
        
        toolGroup = cornerstoneTools.ToolGroupManager.createToolGroup(toolGroupId)
        toolGroup.addViewport(viewportId, renderingEngineId)

        // OPRAVA TADY: Konečně říkáme nástroji "Tvoje domovské tlačítko je kolečko myši"
        if (StackScrollTool) {
          toolGroup.addTool(StackScrollTool.toolName)
          toolGroup.setToolActive(StackScrollTool.toolName, {
            bindings: [{ mouseButton: wheelMouseButton }],
          })
        }

        if (WindowLevelTool) {
          toolGroup.addTool(WindowLevelTool.toolName)
          toolGroup.setToolActive(WindowLevelTool.toolName, {
            bindings: [{ mouseButton: primaryMouseButton }],
          })
        }
        
      } catch (err) {
        console.error("Chyba při vykreslování řezu:", err)
      }
    }

    runRender()

    return () => {
      if (cornerstone) {
        cornerstone.getRenderingEngine("my_engine")?.destroy()
        cornerstone.cache.purgeCache()
      }
    }
  }, [isReady, files])

  if (!isReady) {
    return <div className="text-gray-400 p-4 animate-pulse">Načítám 3D prohlížeč a vyhledávám nástroje...</div>
  }

  return (
    <div className="w-full h-full flex flex-col rounded-xl overflow-hidden border border-gray-700">
      <div className="bg-gray-800 text-gray-300 text-xs px-3 py-1.5 font-bold uppercase tracking-wider">
        DICOM Snímky (Stack)
      </div>
      <div 
        ref={containerRef} 
        className="w-full h-full bg-black cursor-crosshair" 
        onContextMenu={(e) => e.preventDefault()} 
      />
    </div>
  )
}
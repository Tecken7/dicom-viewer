"use client"

import { useState, useRef } from "react"
import JSZip from "jszip"
import CornerstoneViewer from "./CornerstoneViewer"
export default function DicomViewer() {
  // Zde si budeme pamatovat rozbalené DICOM soubory
  const [dicomFiles, setDicomFiles] = useState<File[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Hlavní funkce pro zpracování nahraného ZIPu
  const handleZipUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsLoading(true)
    try {
      const zip = new JSZip()
      const loadedZip = await zip.loadAsync(file)

      const extractedFiles: File[] = []

      // Projdeme všechny soubory uvnitř ZIPu
      for (const relativePath of Object.keys(loadedZip.files)) {
        const zipEntry = loadedZip.files[relativePath]
        
        // Ignorujeme složky a skryté systémové soubory (např. z Macu)
        if (!zipEntry.dir && !relativePath.includes("__MACOSX") && !relativePath.startsWith(".")) {
          // Vytáhneme data ze souboru jako Blob (surová data)
          const blob = await zipEntry.async("blob")
          // Uděláme z toho klasický File, aby se s ním Cornerstone uměl bavit
          const extractedFile = new File([blob], zipEntry.name, { type: "application/dicom" })
          extractedFiles.push(extractedFile)
        }
      }

      setDicomFiles(extractedFiles)
    } catch (error) {
      console.error("Chyba při čtení ZIPu:", error)
      alert("Nepodařilo se rozbalit ZIP soubor. Ujistěte se, že jde o platný formát.")
    } finally {
      setIsLoading(false)
      // Vyčistíme input, aby šel nahrát stejný soubor znovu
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  return (
    <div className="flex h-screen w-screen bg-black font-sans text-white">
      
      {/* LEVÉ MENU (Sidebar) */}
      <div className="w-80 border-r border-gray-800 bg-gray-900 p-5 flex flex-col gap-4 z-10 shadow-xl">
        <div>
          <h1 className="text-2xl font-bold tracking-wide">DICOM Viewer</h1>
          <p className="text-xs text-gray-400 mt-1 uppercase tracking-wider">Powered by Cornerstone3D</p>
        </div>

        {/* Zóna pro nahrání */}
        <div 
          className={`mt-4 border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
            isLoading ? "border-blue-500 bg-blue-500/10" : "border-gray-600 bg-gray-800/50 hover:bg-gray-800 hover:border-gray-400"
          }`}
          onClick={() => !isLoading && fileInputRef.current?.click()}
        >
          {isLoading ? (
            <p className="text-blue-400 font-semibold animate-pulse">Rozbaluji ZIP v paměti...</p>
          ) : (
            <p className="text-sm text-gray-300">
              <span className="block font-bold text-white mb-1">Nahrát CT (ZIP)</span>
              Klikněte pro výběr .zip souboru s DICOM daty
            </p>
          )}
        </div>

        {/* Skrytý input pro výběr souboru */}
        <input 
          type="file" 
          accept=".zip" 
          ref={fileInputRef} 
          className="hidden" 
          onChange={handleZipUpload} 
        />

        {/* Informace o načtených datech */}
        {dicomFiles.length > 0 && (
          <div className="mt-4 p-4 bg-gray-800 rounded-lg border border-gray-700">
            <h2 className="text-sm font-bold text-green-400">✅ ZIP úspěšně rozbalen</h2>
            <p className="text-xs text-gray-300 mt-1">Nalezeno souborů: <span className="font-bold text-white">{dicomFiles.length}</span></p>
          </div>
        )}
      </div>

{/* HLAVNÍ PLOCHA */}
<div className="flex-1 p-3 bg-black">
  {dicomFiles.length > 0 ? (
    <CornerstoneViewer files={dicomFiles} />
  ) : (
    <div className="w-full h-full border border-gray-800 rounded-xl flex items-center justify-center bg-gray-950">
      <p className="text-gray-600 text-lg animate-pulse">Čekám na DICOM data...</p>
    </div>
  )}
</div>

    </div>
  )
}
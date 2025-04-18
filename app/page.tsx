"use client"

import { useState, useRef, useEffect } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Card } from "@/components/ui/card"
import { Loader2, CheckCircle, XCircle, Volume2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { checkApiStatus, processVoice, playAudio, MetadataItem, ProcessResponse } from "@/lib/api-client"
import { MasterDetailsSection } from "@/components/ui/master-details"
import { ZoneSeparator } from "@/components/ui/zone-separator"
import { DebugPanel } from "@/components/ui/debug-panel"

// Types
type CardType = {
  id: string
  content: string
  zone: string | null
  lane: string | null
}

type ProcessingCardType = {
  id: string | null
  zone: string | null
  lane: string | null
}

type GhostCardType = {
  id: string
  content: string
  startX: number
  startY: number
  endX: number
  endY: number
  isAnimating: boolean
}

type ZoneMetadataType = {
  [key: string]: {
    [key: string]: MetadataItem
  }
}

export default function Home() {
  // Initial cards in the holding zone (reduced to 3 voices)
  const initialCards: CardType[] = [
    { id: "voice-1", content: "Voice 1", zone: "holding", lane: "Lane 1" },
    { id: "voice-2", content: "Voice 2", zone: "holding", lane: "Lane 1" },
    { id: "voice-3", content: "Voice 3", zone: "holding", lane: "Lane 1" },
  ]

  const [cards, setCards] = useState<CardType[]>(initialCards)
  const [processingCard, setProcessingCard] = useState<ProcessingCardType>({ id: null, zone: null, lane: null })
  const [apiMessage, setApiMessage] = useState<string>("")
  const [glowingZone, setGlowingZone] = useState<string | null>(null)
  const [invalidZone, setInvalidZone] = useState<string | null>(null)
  const [apiStatus, setApiStatus] = useState<boolean | null>(null)
  const [selectedVoiceCard, setSelectedVoiceCard] = useState<string | null>(null)
  
  // State for zone completion
  const [zoneCompletions, setZoneCompletions] = useState<{ [key: string]: number }>({
    "Zone 1": 0,
    "Zone 2": 0, 
    "Zone 3": 0,
    "Zone 4": 0
  })
  
  // State for zone visibility - only Zone 1 visible initially
  const [zoneVisibility, setZoneVisibility] = useState<{ [key: string]: boolean }>({
    "Zone 1": true,
    "Zone 2": false,
    "Zone 3": false,
    "Zone 4": false
  })
  
  // State for storing metadata for each zone/lane combination
  const [zoneMetadata, setZoneMetadata] = useState<ZoneMetadataType>({})
  
  // State for audio files
  const [playingAudio, setPlayingAudio] = useState<string | null>(null)

  // Check API status on initial load and periodically
  useEffect(() => {
    const checkStatus = async () => {
      const status = await checkApiStatus();
      setApiStatus(status);
    };
    
    // Check immediately and then every 10 seconds
    checkStatus();
    const interval = setInterval(checkStatus, 10000);
    
    return () => clearInterval(interval);
  }, []);

  // For ghost card animation
  const [ghostCard, setGhostCard] = useState<GhostCardType | null>(null)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const cardPositionsRef = useRef(new Map<string, DOMRect>())

  // Define zones and lanes
  const zones = ["holding", "Zone 1", "Zone 2", "Zone 3", "Zone 4"]
  const lanes = ["Lane 1", "Lane 2", "Lane 3"]

  // Track mouse position during drag
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }

    window.addEventListener("mousemove", handleMouseMove)
    return () => {
      window.removeEventListener("mousemove", handleMouseMove)
    }
  }, [])

  // Handle ghost card animation end
  useEffect(() => {
    if (ghostCard?.isAnimating) {
      const timer = setTimeout(() => {
        setGhostCard(null)
      }, 500) // Animation duration
      return () => clearTimeout(timer)
    }
  }, [ghostCard])
  
  // Function to check for zone completion and update visibility
  useEffect(() => {
    // Check for zone completion and update zone visibility
    const checkZoneCompletion = () => {
      // Count unique voices in each zone
      const uniqueVoicesInZone = (zoneName: string) => {
        const voicesInZone = cards
          .filter(card => card.zone === zoneName)
          .map(card => card.content);
        return new Set(voicesInZone).size;
      };
      
      // Update zone completion counts
      const zone1Cards = uniqueVoicesInZone("Zone 1");
      const zone2Cards = uniqueVoicesInZone("Zone 2");
      const zone3Cards = uniqueVoicesInZone("Zone 3");
      const zone4Cards = uniqueVoicesInZone("Zone 4");
      
      setZoneCompletions({
        "Zone 1": zone1Cards,
        "Zone 2": zone2Cards,
        "Zone 3": zone3Cards,
        "Zone 4": zone4Cards
      });
      
      // Update zone visibility based on completion
      if (zone1Cards === 3 && !zoneVisibility["Zone 2"]) {
        setZoneVisibility(prev => ({ ...prev, "Zone 2": true }));
      }
      
      if (zone2Cards === 3 && !zoneVisibility["Zone 3"]) {
        setZoneVisibility(prev => ({ ...prev, "Zone 3": true }));
      }
      
      if (zone3Cards === 3 && !zoneVisibility["Zone 4"]) {
        setZoneVisibility(prev => ({ ...prev, "Zone 4": true }));
      }
    };
    
    checkZoneCompletion();
  }, [cards, zoneVisibility]);

  const isValidMove = (sourceZone: string, destinationZone: string) => {
    // Allow moving from any zone back to the holding zone
    if (destinationZone === "holding") return true

    // Allow moving from holding zone to Zone 1
    if (sourceZone === "holding" && destinationZone === "Zone 1") return true
    
    // Allow moving to adjacent zones, but only if they're visible
    const sourceIndex = zones.indexOf(sourceZone)
    const destIndex = zones.indexOf(destinationZone)
    
    // Check if the destination zone is visible
    if (!zoneVisibility[destinationZone] && destinationZone !== "holding") {
      return false
    }

    // Can only move to adjacent zones (next or previous)
    return Math.abs(sourceIndex - destIndex) === 1
  }

  const handleDragStart = (start: any) => {
    const { draggableId } = start

    // Fix layout widths during drag
    const mainPane = document.querySelector('.main-pane')
    const sidePane = document.querySelector('.side-pane')
    
    if (mainPane) {
      mainPane.setAttribute('style', 'min-width: 70%; max-width: 70%; width: 70%;')
    }
    
    if (sidePane) {
      sidePane.setAttribute('style', 'min-width: 30%; max-width: 30%; width: 30%;')
    }

    // Store positions of all cards
    document.querySelectorAll("[data-rbd-draggable-id]").forEach((el) => {
      const id = el.getAttribute("data-rbd-draggable-id")
      if (id) {
        cardPositionsRef.current.set(id, el.getBoundingClientRect())
      }
    })
  }
  
  // Handle clicking a card in holding zone to play original audio
  const handleCardClick = async (card: CardType) => {
    if (card.zone === "holding") {
      setPlayingAudio(card.id)
      setApiMessage(`Loading ${card.content} audio...`) // Show loading message
      
      try {
        // Call API to get original audio
        const response = await processVoice({
          cardName: card.content,
          zoneName: "holding",
          laneName: card.lane // Lane is now already in the format "Lane X"
        })
        
        console.log("Got API response for audio:", response)
        
        // Check if the API call was successful
        if (response.status === "error") {
          throw new Error(response.message || "API returned an error");
        }
        
        // Play the audio if available
        if (response.audioFile) {
          try {
            setApiMessage(`Playing ${card.content}...`)
            
            // Create an Audio element to test if the file exists
            const audio = new Audio(response.audioFile);
            
            // Set up event listeners
            audio.oncanplaythrough = async () => {
              console.log("Audio can play through, starting playback");
              try {
                await playAudio(response.audioFile as string);
                setApiMessage(`Finished playing ${card.content}`);
              } catch (playError) {
                console.error("Playback error:", playError);
                setApiMessage(`Error during playback: ${playError instanceof Error ? playError.message : String(playError)}`);
              }
            };
            
            audio.onerror = (e) => {
              console.error("Audio loading error:", e, audio.error);
              setApiMessage(`Error loading audio file for ${card.content}`);
              throw new Error(`Failed to load audio: ${audio.error?.message || 'Unknown error'}`);
            };
            
            // Start loading the audio
            audio.load();
          } catch (audioError) {
            console.error("Audio setup error:", audioError);
            setApiMessage(`Error setting up audio for ${card.content}: ${audioError instanceof Error ? audioError.message : String(audioError)}`);
          }
        } else {
          setApiMessage(`No audio file returned for ${card.content}`);
        }
      } catch (error) {
        console.error("Card click error:", error);
        setApiMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setTimeout(() => {
          setPlayingAudio(null);
        }, 1000); // Give a delay before clearing the playing state
      }
    } else {
      // If card is in a processing zone, select it to show in master details
      setSelectedVoiceCard(card.content);
    }
  }

  const handleDragEnd = async (result: any) => {
    const { source, destination, draggableId } = result

    // Ensure layout widths remain fixed
    const mainPane = document.querySelector('.main-pane')
    const sidePane = document.querySelector('.side-pane')
    
    if (mainPane) {
      mainPane.setAttribute('style', 'min-width: 70%; max-width: 70%; width: 70%;')
    }
    
    if (sidePane) {
      sidePane.setAttribute('style', 'min-width: 30%; max-width: 30%; width: 30%;')
    }

    // Find the card that was dragged
    const draggedCard = cards.find((card) => card.id === draggableId)
    if (!draggedCard) return

    // Get original position
    const originalPosition = cardPositionsRef.current.get(draggableId)
    
    // Function to animate card flying back
    const flyCardBack = () => {
      if (originalPosition) {
        setGhostCard({
          id: draggableId,
          content: draggedCard.content,
          startX: mousePosition.x,
          startY: mousePosition.y,
          endX: originalPosition.left + originalPosition.width / 2,
          endY: originalPosition.top + originalPosition.height / 2,
          isAnimating: true,
        })
      }
    }

    // Dropped outside a droppable area or invalid move
    if (!destination || !isValidMove(source.droppableId.split("-")[0], destination.droppableId.split("-")[0])) {
      // Show red glow if dropped in invalid zone
      if (destination) {
        const destZoneId = destination.droppableId.split("-")[0]
        setInvalidZone(destZoneId)
        setTimeout(() => setInvalidZone(null), 1000)
      }

      // Create ghost card for animation
      flyCardBack()
      return
    }
    
    // Check if the destination lane already has a card (unless it's the holding zone)
    if (destination.droppableId !== "holding-1") {
      const destZoneId = destination.droppableId.split("-")[0]
      const destLaneId = destination.droppableId.split("-")[1]
      const destLaneName = `Lane ${destLaneId}`
      
      // Check if there's already a card in this lane
      const isLaneOccupied = cards.some(card => 
        card.id !== draggableId && // Not the card being dragged
        card.zone === destZoneId && 
        card.lane === destLaneName
      )
      
      if (isLaneOccupied) {
        // Show red glow on the destination zone
        setInvalidZone(destZoneId)
        setTimeout(() => setInvalidZone(null), 1000)
        
        // Make the card fly back to its original position
        flyCardBack()
        return
      }
    }

    const sourceZoneId = source.droppableId.split("-")[0]
    const destZoneId = destination.droppableId.split("-")[0]
    
    // Get the lane from the droppable ID
    let destLaneName = "Lane 1";
    if (destZoneId !== "holding") {
      // Extract lane number from droppable ID (e.g., "Zone 1-1" -> "Lane 1")
      const destLaneNumber = destination.droppableId.split("-")[1];
      destLaneName = `Lane ${destLaneNumber}`;
    }

    // Update card position
    const updatedCards = cards.map((card) => {
      if (card.id === draggableId) {
        // If moving to holding zone, clear the API message
        if (destZoneId === "holding") {
          setApiMessage("")
          return { ...card, zone: "holding", lane: card.lane }
        }

        // Set processing state
        setProcessingCard({ id: card.id, zone: destZoneId, lane: destLaneName })
        
        // Select the voice card to show in master details
        setSelectedVoiceCard(card.content)

        // Trigger zone glow effect
        setGlowingZone(destZoneId)
        setTimeout(() => setGlowingZone(null), 1000)

        // Call API and process response
        processVoice({
          cardName: card.content,
          zoneName: destZoneId,
          laneName: destLaneName
        }).then((response: ProcessResponse) => {
          setApiMessage(response.message)
          
          // Store metadata if available
          if (response.metadata) {
            setZoneMetadata(prev => ({
              ...prev,
              [destZoneId]: {
                ...(prev[destZoneId] || {}),
                [card.content]: response.metadata as MetadataItem
              }
            }))
          }
          
          // Play audio if available
          if (response.audioFile) {
            playAudio(response.audioFile)
          }
          
          // Clear processing state after API call completes
          setProcessingCard({ id: null, zone: null, lane: null })
        }).catch((error) => {
          // Handle API errors
          setApiMessage(`Error: ${error.message}`)
          setProcessingCard({ id: null, zone: null, lane: null })
        })

        return { ...card, zone: destZoneId, lane: destLaneName }
      }
      return card
    })

    setCards(updatedCards)
  }

  return (
    <div className="flex h-screen overflow-hidden bg-indigo-800 text-white" style={{ minWidth: "100vw" }}>
      {/* Main scrollable content area - fixed at 70% with minimum width */}
      <div className="w-[70%] overflow-y-auto p-4 main-pane" style={{ minWidth: "70%", maxWidth: "70%" }}>
        <div className="mb-6 flex justify-between items-center">
          <h1 className="text-3xl font-bold">VOCAL BOX BIAS</h1>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">API Status:</span>
            {apiStatus === null && <Loader2 className="h-5 w-5 animate-spin text-gray-300" />}
            {apiStatus === true && <CheckCircle className="h-5 w-5 text-green-300" />}
            {apiStatus === false && <XCircle className="h-5 w-5 text-red-300" />}
          </div>
        </div>
        
        <p className="text-lg mb-8">
          Pick up the voices and place them in one of the boxes
        </p>

        {apiMessage && (
          <div className="mb-6 p-4 bg-indigo-700 rounded-lg border border-indigo-600">
            <p>{apiMessage}</p>
          </div>
        )}

        {/* Ghost Card for Animation */}
        {ghostCard && (
          <div
            className={`fixed pointer-events-none z-50 transition-all duration-500 ease-in-out ${ghostCard.isAnimating ? "opacity-100" : "opacity-0"}`}
            style={{
              left: ghostCard.isAnimating ? ghostCard.endX : ghostCard.startX,
              top: ghostCard.isAnimating ? ghostCard.endY : ghostCard.startY,
              transform: "translate(-50%, -50%)",
              width: "200px",
              transition: "left 500ms ease-in-out, top 500ms ease-in-out",
            }}
          >
            <Card className="p-3 bg-white shadow-md">
              <p className="font-medium">{ghostCard.content}</p>
            </Card>
          </div>
        )}

        <DragDropContext onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          {/* Holding Zone */}
          <div className="mb-4">
            <h2 className="text-xl font-semibold mb-2">Holding Zone</h2>
            <div className="w-full">
              <Droppable key="holding-lane" droppableId="holding-1" direction="horizontal">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    style={{
                      backgroundColor: '#e2e8f0',
                      minHeight: '100px',
                      borderRadius: '0.5rem',
                      padding: '0.5rem',
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      overflowX: 'auto',
                      border: '2px dashed #64748b'
                    }}
                  >
                    {cards.map((card, index) => {
                      if (card.zone === "holding") {
                        return (
                          <Draggable key={card.id} draggableId={card.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="mx-2"
                                style={{
                                  ...provided.draggableProps.style,
                                }}
                                onClick={() => handleCardClick(card)}
                              >
                                <Card className={cn(
                                  "p-3 bg-amber-300 shadow-md relative cursor-pointer hover:ring-2 hover:ring-blue-300 w-48 text-gray-800",
                                  playingAudio === card.id && "ring-2 ring-blue-500"
                                )}>
                                  <div className="flex items-center justify-between">
                                    <p className="font-medium">{card.content}</p>
                                    <Volume2 className="h-4 w-4 text-blue-500" />
                                  </div>
                                  <p className="text-xs text-gray-700 mt-1">
                                    Click to play audio
                                  </p>
                                  {playingAudio === card.id && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                                      <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                    </div>
                                  )}
                                </Card>
                              </div>
                            )}
                          </Draggable>
                        )
                      }
                      return null
                    })}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </div>
          </div>
          
          {/* Wall between Holding Zone and Zone 1 */}
          <ZoneSeparator color="purple" />

          {/* Zone 1 */}
          {zoneVisibility["Zone 1"] && (
            <>
              <h2 className="text-xl font-semibold mb-4">Zone 1</h2>
              <div className="flex flex-row justify-between space-x-4 w-full">
                {lanes.map((lane, laneIndex) => (
                  <div key={`Zone 1-lane-${laneIndex + 1}`} className="flex-1">
                    <div className="text-sm font-medium text-white mb-2 bg-indigo-900 inline-block p-1 rounded">
                      {lane}
                    </div>
                    <Droppable 
                      key={`Zone 1-${laneIndex + 1}`} 
                      droppableId={`Zone 1-${laneIndex + 1}`} 
                      direction="horizontal"
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{ 
                            backgroundColor: laneIndex === 0 ? '#fef3c7' : laneIndex === 1 ? '#fcd34d' : '#f59e0b',
                            minHeight: '100px',
                            borderRadius: '0.5rem',
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            width: '100%',
                            overflowX: 'auto',
                            boxShadow: glowingZone === "Zone 1" ? '0 0 0 4px #fcd34d' : invalidZone === "Zone 1" ? '0 0 0 4px #ef4444' : 'none'
                          }}
                        >
                          {cards.map((card, index) => {
                            if (card.zone === "Zone 1" && card.lane === lane) {
                              return (
                                <Draggable key={card.id} draggableId={card.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className="mx-2"
                                      style={{
                                        ...provided.draggableProps.style,
                                      }}
                                      onClick={() => handleCardClick(card)}
                                    >
                                      <Card
                                        className={cn(
                                          "p-3 bg-amber-300 shadow-md relative w-48 cursor-pointer text-gray-800",
                                          processingCard.id === card.id && "opacity-70",
                                          selectedVoiceCard === card.content && "ring-2 ring-blue-500"
                                        )}
                                      >
                                        <p className="font-medium">{card.content}</p>
                                        {processingCard.id === card.id && (
                                          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                          </div>
                                        )}
                                      </Card>
                                    </div>
                                  )}
                                </Draggable>
                              )
                            }
                            return null
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Wall between Zone 1 and Zone 2 */}
          {zoneVisibility["Zone 2"] && <ZoneSeparator color="amber" />}

          {/* Zone 2 */}
          {zoneVisibility["Zone 2"] && (
            <>
              <h2 className="text-xl font-semibold mb-4">Zone 2</h2>
              <div className="flex flex-row justify-between space-x-4 w-full">
                {lanes.map((lane, laneIndex) => (
                  <div key={`Zone 2-lane-${laneIndex + 1}`} className="flex-1">
                    <div className="text-sm font-medium text-white mb-2 bg-indigo-900 inline-block p-1 rounded">
                      {lane}
                    </div>
                    <Droppable 
                      key={`Zone 2-${laneIndex + 1}`} 
                      droppableId={`Zone 2-${laneIndex + 1}`} 
                      direction="horizontal"
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{ 
                            backgroundColor: laneIndex === 0 ? '#dcfce7' : laneIndex === 1 ? '#86efac' : '#22c55e',
                            minHeight: '100px',
                            borderRadius: '0.5rem',
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            width: '100%',
                            overflowX: 'auto',
                            boxShadow: glowingZone === "Zone 2" ? '0 0 0 4px #fcd34d' : invalidZone === "Zone 2" ? '0 0 0 4px #ef4444' : 'none'
                          }}
                        >
                          {cards.map((card, index) => {
                            if (card.zone === "Zone 2" && card.lane === lane) {
                              return (
                                <Draggable key={card.id} draggableId={card.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className="mx-2"
                                      style={{
                                        ...provided.draggableProps.style,
                                      }}
                                      onClick={() => handleCardClick(card)}
                                    >
                                      <Card
                                        className={cn(
                                          "p-3 bg-green-300 shadow-md relative w-48 cursor-pointer text-gray-800",
                                          processingCard.id === card.id && "opacity-70",
                                          selectedVoiceCard === card.content && "ring-2 ring-blue-500"
                                        )}
                                      >
                                        <p className="font-medium">{card.content}</p>
                                        {processingCard.id === card.id && (
                                          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                          </div>
                                        )}
                                      </Card>
                                    </div>
                                  )}
                                </Draggable>
                              )
                            }
                            return null
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
              </div>
            </>
          )}

          {/* Wall between Zone 2 and Zone 3 */}
          {zoneVisibility["Zone 3"] && <ZoneSeparator color="green" />}

          {/* Zone 3 */}
          {zoneVisibility["Zone 3"] && (
            <>
              <h2 className="text-xl font-semibold mb-4">Zone 3</h2>
              <div className="flex flex-row justify-between space-x-4 w-full">
                {lanes.map((lane, laneIndex) => (
                  <div key={`Zone 3-lane-${laneIndex + 1}`} className="flex-1">
                    <div className="text-sm font-medium text-white mb-2 bg-indigo-900 inline-block p-1 rounded">
                      {lane}
                    </div>
                    <Droppable 
                      key={`Zone 3-${laneIndex + 1}`} 
                      droppableId={`Zone 3-${laneIndex + 1}`} 
                      direction="horizontal"
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{ 
                            backgroundColor: laneIndex === 0 ? '#dbeafe' : laneIndex === 1 ? '#93c5fd' : '#3b82f6',
                            minHeight: '100px',
                            borderRadius: '0.5rem',
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            width: '100%',
                            overflowX: 'auto',
                            boxShadow: glowingZone === "Zone 3" ? '0 0 0 4px #fcd34d' : invalidZone === "Zone 3" ? '0 0 0 4px #ef4444' : 'none'
                          }}
                        >
                          {cards.map((card, index) => {
                            if (card.zone === "Zone 3" && card.lane === lane) {
                              return (
                                <Draggable key={card.id} draggableId={card.id} index={index}>
                                  {(provided, snapshot) => (
                                    <div
                                      ref={provided.innerRef}
                                      {...provided.draggableProps}
                                      {...provided.dragHandleProps}
                                      className="mx-2"
                                      style={{
                                        ...provided.draggableProps.style,
                                      }}
                                      onClick={() => handleCardClick(card)}
                                    >
                                      <Card
                                        className={cn(
                                          "p-3 bg-blue-300 shadow-md relative w-48 cursor-pointer text-gray-800",
                                          processingCard.id === card.id && "opacity-70",
                                          selectedVoiceCard === card.content && "ring-2 ring-blue-500"
                                        )}
                                      >
                                        <p className="font-medium">{card.content}</p>
                                        {processingCard.id === card.id && (
                                          <div className="absolute inset-0 flex items-center justify-center bg-white/70">
                                            <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
                                          </div>
                                        )}
                                      </Card>
                                    </div>
                                  )}
                                </Draggable>
                              )
                            }
                            return null
                          })}
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  </div>
                ))}
              </div>
            </>
          )}
          
          {/* Additional padding at the bottom for scrolling */}
          <div className="h-24"></div>
        </DragDropContext>
      </div>

      {/* Fixed right sidebar for master details section */}
      <div className="w-[30%] bg-slate-700 p-6 overflow-y-auto border-l border-slate-600 shadow-inner side-pane" style={{ minWidth: "30%", maxWidth: "30%" }}>
        <MasterDetailsSection 
          zoneMetadata={zoneMetadata}
          zoneCompletions={zoneCompletions}
          selectedVoiceCard={selectedVoiceCard}
          totalVoices={3}
          processingCard={processingCard}
        />
      </div>
      
      {/* Debug Panel */}
      <DebugPanel />
    </div>
  )
}
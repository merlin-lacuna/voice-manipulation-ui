"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Card } from "@/components/ui/card"
import { Loader2, CheckCircle, XCircle, Volume2 } from "lucide-react"
import { cn, isLaneSticky, isLaneBlocking, getLaneNumber, getZoneNumber } from "@/lib/utils"
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
  asFarAsCanGo?: boolean // Track if card has reached its furthest possible position
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
    { id: "voice-1", content: "Voice 1", zone: "holding", lane: "Lane 1", asFarAsCanGo: false },
    { id: "voice-2", content: "Voice 2", zone: "holding", lane: "Lane 1", asFarAsCanGo: false },
    { id: "voice-3", content: "Voice 3", zone: "holding", lane: "Lane 1", asFarAsCanGo: false },
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
  
  // Track historical presence of voice cards in each zone
  const [historicalZonePresence, setHistoricalZonePresence] = useState<{
    [key: string]: Set<string>
  }>({
    "Zone 1": new Set(),
    "Zone 2": new Set(),
    "Zone 3": new Set(),
    "Zone 4": new Set()
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
  }, [setMousePosition])

  // Handle ghost card animation end
  useEffect(() => {
    if (ghostCard?.isAnimating) {
      const timer = setTimeout(() => {
        setGhostCard(null)
      }, 500) // Animation duration
      return () => clearTimeout(timer)
    }
  }, [ghostCard])
  
  // Helper function to check if all cards are as far as they can go
  const areAllCardsAsFarAsTheyCanGo = useCallback(() => {
    return cards.every(card => card.asFarAsCanGo === true);
  }, [cards]);
  
  // Helper function to check if a new zone should be revealed
  const shouldRevealNextZone = (currentZone: string) => {
    // Only reveal next zone if all cards have reached as far as they can go
    return areAllCardsAsFarAsTheyCanGo();
  };
  
  // Effect to update historical zone presence based on cards
  useEffect(() => {
    // Create a new object to hold updated zone presence
    const newZonePresence = { ...historicalZonePresence };
    let hasChanges = false;
    
    // Update historical zone presence for current card positions
    cards.forEach(card => {
      if (card.zone && card.zone !== "holding") {
        // Add this voice to the historical presence for this zone
        const zoneSet = new Set(newZonePresence[card.zone].values());
        if (!zoneSet.has(card.content)) {
          zoneSet.add(card.content);
          newZonePresence[card.zone] = zoneSet;
          hasChanges = true;
        }
      }
    });
    
    // Only update state if there were changes
    if (hasChanges) {
      setHistoricalZonePresence(newZonePresence);
    }
  }, [cards]);
  
  // Separate effect to update zone completions based on historical presence
  useEffect(() => {    
    // Get the count of voices that have historically been in each zone
    const zone1HistoricalCount = historicalZonePresence["Zone 1"].size;
    const zone2HistoricalCount = historicalZonePresence["Zone 2"].size;
    const zone3HistoricalCount = historicalZonePresence["Zone 3"].size;
    const zone4HistoricalCount = historicalZonePresence["Zone 4"].size;
    
    // Update zone completion counts based on historical presence
    setZoneCompletions({
      "Zone 1": zone1HistoricalCount,
      "Zone 2": zone2HistoricalCount,
      "Zone 3": zone3HistoricalCount,
      "Zone 4": zone4HistoricalCount
    });
  }, [historicalZonePresence]);
  
  // Separate effect to update zone visibility based on zone completions and card positions
  useEffect(() => {
    const zone1HistoricalCount = historicalZonePresence["Zone 1"].size;
    const zone2HistoricalCount = historicalZonePresence["Zone 2"].size;
    const zone3HistoricalCount = historicalZonePresence["Zone 3"].size;
    
    // Check if all cards have reached as far as they can go
    const allCardsAtMaxPosition = cards.every(card => card.asFarAsCanGo === true);
    
    // Update zone visibility based on whether all cards have reached their furthest possible position
    if (zone1HistoricalCount > 0 && allCardsAtMaxPosition && !zoneVisibility["Zone 2"]) {
      setZoneVisibility(prev => ({ ...prev, "Zone 2": true }));
      
      // Reset asFarAsCanGo for cards that aren't in sticky lanes
      setCards(prevCards => prevCards.map(card => {
        // Skip cards in sticky lanes
        if (card.zone && card.lane) {
          const laneNumber = getLaneNumber(card.lane);
          if (isLaneSticky(card.zone, laneNumber)) {
            return card; // Keep sticky lane cards as asFarAsCanGo=true
          }
        }
        // Reset for non-sticky cards if they're not in the last zone
        if (card.zone !== "Zone 3" && card.zone !== "Zone 4") {
          return { ...card, asFarAsCanGo: false };
        }
        return card;
      }));
    }
    
    if (zone2HistoricalCount > 0 && allCardsAtMaxPosition && !zoneVisibility["Zone 3"]) {
      setZoneVisibility(prev => ({ ...prev, "Zone 3": true }));
      
      // Reset asFarAsCanGo for cards that aren't in sticky lanes
      setCards(prevCards => prevCards.map(card => {
        // Skip cards in sticky lanes
        if (card.zone && card.lane) {
          const laneNumber = getLaneNumber(card.lane);
          if (isLaneSticky(card.zone, laneNumber)) {
            return card; // Keep sticky lane cards as asFarAsCanGo=true
          }
        }
        // Reset for non-sticky cards if they're not in the last zone
        if (card.zone !== "Zone 4") {
          return { ...card, asFarAsCanGo: false };
        }
        return card;
      }));
    }
    
    if (zone3HistoricalCount > 0 && allCardsAtMaxPosition && !zoneVisibility["Zone 4"]) {
      setZoneVisibility(prev => ({ ...prev, "Zone 4": true }));
    }
  }, [cards, zoneVisibility, historicalZonePresence]);

  const isValidMove = (
    sourceZone: string, 
    destinationZone: string, 
    sourceLane?: string, 
    cardId?: string
  ) => {
    // Check for sticky lane: if card is in a sticky lane, it cannot be moved
    if (cardId && sourceLane) {
      const card = cards.find(c => c.id === cardId)
      if (card && card.lane === sourceLane) {
        const laneNumber = getLaneNumber(sourceLane)
        // If the card is in a sticky lane, prevent any movement
        if (isLaneSticky(sourceZone, laneNumber)) {
          return false
        }
        
        // Check for blocking lane: if card is in a blocking lane, it can only move within same zone
        if (isLaneBlocking(sourceZone, laneNumber)) {
          const sourceZoneNum = getZoneNumber(sourceZone)
          const destZoneNum = getZoneNumber(destinationZone)
          
          // If trying to move to a higher zone, block the move
          if (destZoneNum > sourceZoneNum) {
            return false
          }
        }
      }
    }

    // Allow moving from any zone back to the holding zone (unless in sticky lane)
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

    // Same zone moves are always allowed
    if (sourceZone === destinationZone) {
      return true
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

    // Extract source information
    const sourceZoneId = source.droppableId.split("-")[0]
    const sourceLaneId = source.droppableId.split("-")[1]
    const sourceLaneName = sourceLaneId ? `Lane ${sourceLaneId}` : null
    
    // Extract destination information
    const destZoneId = destination?.droppableId.split("-")[0]
    
    // Dropped outside a droppable area or invalid move
    if (!destination || !isValidMove(
      sourceZoneId, 
      destZoneId, 
      sourceLaneName, 
      draggableId
    )) {
      // Show red glow if dropped in invalid zone
      if (destination) {
        setInvalidZone(destination.droppableId.split("-")[0])
        setTimeout(() => setInvalidZone(null), 1000)
      }

      // Create ghost card for animation
      flyCardBack()
      
      // Show message for sticky or blocking lanes
      if (sourceLaneName) {
        const laneNumber = getLaneNumber(sourceLaneName)
        const sourceZoneNum = getZoneNumber(sourceZoneId)
        const destZoneNum = destZoneId ? getZoneNumber(destZoneId) : 0
        
        if (isLaneSticky(sourceZoneId, laneNumber)) {
          setApiMessage("This card is in a sticky lane and cannot be moved")
          setTimeout(() => setApiMessage(""), 2000)
        } 
        else if (isLaneBlocking(sourceZoneId, laneNumber) && destZoneNum > sourceZoneNum) {
          setApiMessage(`This card is in a blocking lane and cannot be moved to Zone ${destZoneNum}`)
          setTimeout(() => setApiMessage(""), 2000)
        }
      }
      
      return
    }
    
    // Check if the destination lane already has a card (unless it's the holding zone)
    if (destination.droppableId !== "holding-1") {
      const destZoneId = destination.droppableId.split("-")[0]
      const destLaneId = destination.droppableId.split("-")[1]
      const destLaneName = `Lane ${destLaneId}`
      
      // If we're moving from one lane to another, check if the destination is occupied
      if (source.droppableId !== destination.droppableId) {
        // Check if there's already a card in this lane (that isn't the card being dragged)
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
          
          // Show informative message
          setApiMessage("This lane already contains a card")
          setTimeout(() => setApiMessage(""), 2000)
          
          return
        }
      }
    }

    // These variables are already defined above
    // const sourceZoneId = source.droppableId.split("-")[0]
    // const destZoneId = destination.droppableId.split("-")[0]
    
    // Get the lane from the droppable ID
    let destLaneName = "Lane 1";
    if (destZoneId !== "holding") {
      // Extract lane number from droppable ID (e.g., "Zone 1-1" -> "Lane 1")
      const destLaneNumber = destination.droppableId.split("-")[1];
      destLaneName = `Lane ${destLaneNumber}`;
    }

    // If moving to a processing zone (not holding or not going backwards), 
    // add this voice to the historical presence for this zone
    if (destZoneId !== "holding" && getZoneNumber(destZoneId) >= getZoneNumber(sourceZoneId)) {
      setHistoricalZonePresence(prev => {
        const updatedZonePresence = { ...prev };
        updatedZonePresence[destZoneId] = new Set(prev[destZoneId]);
        updatedZonePresence[destZoneId].add(draggedCard.content);
        return updatedZonePresence;
      });
    }
    
    // If moving backwards to a previous zone, remove from historical presence
    // for current and higher zones (only if being moved back to holding or earlier zone)
    if (
      (destZoneId === "holding" && sourceZoneId !== "holding") || 
      (sourceZoneId !== "holding" && destZoneId !== "holding" && getZoneNumber(destZoneId) < getZoneNumber(sourceZoneId))
    ) {
      setHistoricalZonePresence(prev => {
        const updatedZonePresence = { ...prev };
        
        // Get the source zone number
        const sourceZoneNum = getZoneNumber(sourceZoneId);
        
        // Remove from this zone and all higher zones
        zones.forEach(zone => {
          if (zone !== "holding") {
            const zoneNum = getZoneNumber(zone);
            // If this zone is >= the source zone, remove the voice
            if (zoneNum >= sourceZoneNum) {
              updatedZonePresence[zone] = new Set(prev[zone]);
              updatedZonePresence[zone].delete(draggedCard.content);
            }
          }
        });
        
        return updatedZonePresence;
      });
    }

    // Update card position
    const updatedCards = cards.map((card) => {
      if (card.id === draggableId) {
        // If moving to holding zone, clear the API message and reset asFarAsCanGo
        if (destZoneId === "holding") {
          setApiMessage("")
          return { ...card, zone: "holding", lane: card.lane, asFarAsCanGo: false }
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

        // Set asFarAsCanGo to true if card is placed in a sticky lane
        const laneNumber = getLaneNumber(destLaneName);
        const isSticky = isLaneSticky(destZoneId, laneNumber);
        
        // Calculate if this card is as far as it can go
        // True if: 1) It's in a sticky lane, 2) It's in Zone 4, 3) It's moving to a higher zone than before
        // Get zone numbers
        const sourceZoneNum = getZoneNumber(sourceZoneId);
        const destZoneNum = getZoneNumber(destZoneId);
        
        // Card is "as far as it can go" if:
        const isMovingToHigherZone = destZoneNum > sourceZoneNum; // Moving to a higher zone number
        const newAsFarAsCanGo = isSticky || destZoneId === "Zone 4" || isMovingToHigherZone;
        
        return { 
          ...card, 
          zone: destZoneId, 
          lane: destLaneName,
          asFarAsCanGo: newAsFarAsCanGo
        }
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
                    <div className="flex items-center mb-2">
                      <div className={`text-sm font-medium text-white bg-indigo-900 inline-block p-1 rounded
                        ${isLaneSticky("Zone 1", laneIndex + 1) ? 'border-2 border-red-500' : 
                          isLaneBlocking("Zone 1", laneIndex + 1) ? 'border-2 border-orange-500' : ''}`}>
                        {lane}
                        {isLaneSticky("Zone 1", laneIndex + 1) && (
                          <span className="ml-1 text-xs text-red-300">STICKY</span>
                        )}
                        {isLaneBlocking("Zone 1", laneIndex + 1) && !isLaneSticky("Zone 1", laneIndex + 1) && (
                          <span className="ml-1 text-xs text-orange-300">BLOCKING</span>
                        )}
                      </div>
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
                            boxShadow: glowingZone === "Zone 1" ? '0 0 0 4px #fcd34d' : 
                                       invalidZone === "Zone 1" ? '0 0 0 4px #ef4444' : 
                                       isLaneSticky("Zone 1", laneIndex + 1) ? '0 0 0 3px #ef4444' : 
                                       isLaneBlocking("Zone 1", laneIndex + 1) ? '0 0 0 2px #f97316' : 'none',
                            borderTop: isLaneSticky("Zone 1", laneIndex + 1) ? '3px dashed #ef4444' : 
                                       isLaneBlocking("Zone 1", laneIndex + 1) ? '3px dotted #f97316' : 'none',
                            borderBottom: isLaneSticky("Zone 1", laneIndex + 1) ? '3px dashed #ef4444' :
                                         isLaneBlocking("Zone 1", laneIndex + 1) ? '3px dotted #f97316' : 'none'
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
                                          selectedVoiceCard === card.content && "ring-2 ring-blue-500",
                                          card.asFarAsCanGo && "border-b-4 border-purple-600"
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
                    <div className="flex items-center mb-2">
                      <div className={`text-sm font-medium text-white bg-indigo-900 inline-block p-1 rounded
                        ${isLaneSticky("Zone 2", laneIndex + 1) ? 'border-2 border-red-500' : 
                          isLaneBlocking("Zone 2", laneIndex + 1) ? 'border-2 border-orange-500' : ''}`}>
                        {lane}
                        {isLaneSticky("Zone 2", laneIndex + 1) && (
                          <span className="ml-1 text-xs text-red-300">STICKY</span>
                        )}
                        {isLaneBlocking("Zone 2", laneIndex + 1) && !isLaneSticky("Zone 2", laneIndex + 1) && (
                          <span className="ml-1 text-xs text-orange-300">BLOCKING</span>
                        )}
                      </div>
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
                            boxShadow: glowingZone === "Zone 2" ? '0 0 0 4px #fcd34d' : 
                                       invalidZone === "Zone 2" ? '0 0 0 4px #ef4444' : 
                                       isLaneSticky("Zone 2", laneIndex + 1) ? '0 0 0 3px #ef4444' : 
                                       isLaneBlocking("Zone 2", laneIndex + 1) ? '0 0 0 2px #f97316' : 'none',
                            borderTop: isLaneSticky("Zone 2", laneIndex + 1) ? '3px dashed #ef4444' : 
                                       isLaneBlocking("Zone 2", laneIndex + 1) ? '3px dotted #f97316' : 'none',
                            borderBottom: isLaneSticky("Zone 2", laneIndex + 1) ? '3px dashed #ef4444' :
                                          isLaneBlocking("Zone 2", laneIndex + 1) ? '3px dotted #f97316' : 'none'
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
                                          selectedVoiceCard === card.content && "ring-2 ring-blue-500",
                                          card.asFarAsCanGo && "border-b-4 border-purple-600"
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
                    <div className="flex items-center mb-2">
                      <div className={`text-sm font-medium text-white bg-indigo-900 inline-block p-1 rounded
                        ${isLaneSticky("Zone 3", laneIndex + 1) ? 'border-2 border-red-500' : 
                          isLaneBlocking("Zone 3", laneIndex + 1) ? 'border-2 border-orange-500' : ''}`}>
                        {lane}
                        {isLaneSticky("Zone 3", laneIndex + 1) && (
                          <span className="ml-1 text-xs text-red-300">STICKY</span>
                        )}
                        {isLaneBlocking("Zone 3", laneIndex + 1) && !isLaneSticky("Zone 3", laneIndex + 1) && (
                          <span className="ml-1 text-xs text-orange-300">BLOCKING</span>
                        )}
                      </div>
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
                            boxShadow: glowingZone === "Zone 3" ? '0 0 0 4px #fcd34d' : 
                                       invalidZone === "Zone 3" ? '0 0 0 4px #ef4444' : 
                                       isLaneSticky("Zone 3", laneIndex + 1) ? '0 0 0 3px #ef4444' : 
                                       isLaneBlocking("Zone 3", laneIndex + 1) ? '0 0 0 2px #f97316' : 'none',
                            borderTop: isLaneSticky("Zone 3", laneIndex + 1) ? '3px dashed #ef4444' : 
                                       isLaneBlocking("Zone 3", laneIndex + 1) ? '3px dotted #f97316' : 'none',
                            borderBottom: isLaneSticky("Zone 3", laneIndex + 1) ? '3px dashed #ef4444' :
                                          isLaneBlocking("Zone 3", laneIndex + 1) ? '3px dotted #f97316' : 'none'
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
                                          selectedVoiceCard === card.content && "ring-2 ring-blue-500",
                                          card.asFarAsCanGo && "border-b-4 border-purple-600"
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
          
          {/* Wall between Zone 3 and Zone 4 */}
          {zoneVisibility["Zone 4"] && <ZoneSeparator color="blue" />}

          {/* Zone 4 */}
          {zoneVisibility["Zone 4"] && (
            <>
              <h2 className="text-xl font-semibold mb-4">Zone 4</h2>
              <div className="flex flex-row justify-between space-x-4 w-full">
                {lanes.map((lane, laneIndex) => (
                  <div key={`Zone 4-lane-${laneIndex + 1}`} className="flex-1">
                    <div className="flex items-center mb-2">
                      <div className={`text-sm font-medium text-white bg-indigo-900 inline-block p-1 rounded
                        ${isLaneSticky("Zone 4", laneIndex + 1) ? 'border-2 border-red-500' : 
                          isLaneBlocking("Zone 4", laneIndex + 1) ? 'border-2 border-orange-500' : ''}`}>
                        {lane}
                        {isLaneSticky("Zone 4", laneIndex + 1) && (
                          <span className="ml-1 text-xs text-red-300">STICKY</span>
                        )}
                        {isLaneBlocking("Zone 4", laneIndex + 1) && !isLaneSticky("Zone 4", laneIndex + 1) && (
                          <span className="ml-1 text-xs text-orange-300">BLOCKING</span>
                        )}
                      </div>
                    </div>
                    <Droppable 
                      key={`Zone 4-${laneIndex + 1}`} 
                      droppableId={`Zone 4-${laneIndex + 1}`} 
                      direction="horizontal"
                    >
                      {(provided) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          style={{ 
                            backgroundColor: laneIndex === 0 ? '#f9a8d4' : laneIndex === 1 ? '#ec4899' : '#be185d',
                            minHeight: '100px',
                            borderRadius: '0.5rem',
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            width: '100%',
                            overflowX: 'auto',
                            boxShadow: glowingZone === "Zone 4" ? '0 0 0 4px #fcd34d' : 
                                       invalidZone === "Zone 4" ? '0 0 0 4px #ef4444' : 
                                       isLaneSticky("Zone 4", laneIndex + 1) ? '0 0 0 3px #ef4444' : 
                                       isLaneBlocking("Zone 4", laneIndex + 1) ? '0 0 0 2px #f97316' : 'none',
                            borderTop: isLaneSticky("Zone 4", laneIndex + 1) ? '3px dashed #ef4444' : 
                                       isLaneBlocking("Zone 4", laneIndex + 1) ? '3px dotted #f97316' : 'none',
                            borderBottom: isLaneSticky("Zone 4", laneIndex + 1) ? '3px dashed #ef4444' :
                                          isLaneBlocking("Zone 4", laneIndex + 1) ? '3px dotted #f97316' : 'none'
                          }}
                        >
                          {cards.map((card, index) => {
                            if (card.zone === "Zone 4" && card.lane === lane) {
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
                                          "p-3 bg-pink-300 shadow-md relative w-48 cursor-pointer text-gray-800",
                                          processingCard.id === card.id && "opacity-70",
                                          selectedVoiceCard === card.content && "ring-2 ring-blue-500",
                                          card.asFarAsCanGo && "border-b-4 border-purple-600"
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
      <DebugPanel 
        cards={cards}
        areAllCardsAsFarAsTheyCanGo={areAllCardsAsFarAsTheyCanGo()}
      />
    </div>
  )
}
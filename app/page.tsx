"use client"

import { useState, useRef, useEffect } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Card } from "@/components/ui/card"
import { Loader2, CheckCircle, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"
import { checkApiStatus } from "@/lib/api-client"

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

// Import API client
import { processVoice } from "@/lib/api-client"

export default function Home() {
  // Initial cards in the holding zone
  const initialCards: CardType[] = [
    { id: "voice-a", content: "Voice A", zone: "holding", lane: "1" },
    { id: "voice-b", content: "Voice B", zone: "holding", lane: "2" },
    { id: "voice-c", content: "Voice C", zone: "holding", lane: "3" },
    { id: "voice-d", content: "Voice D", zone: "holding", lane: "4" },
    { id: "voice-e", content: "Voice E", zone: "holding", lane: "5" },
  ]

  const [cards, setCards] = useState<CardType[]>(initialCards)
  const [processingCard, setProcessingCard] = useState<ProcessingCardType>({ id: null, zone: null, lane: null })
  const [apiMessage, setApiMessage] = useState<string>("")
  const [glowingZone, setGlowingZone] = useState<string | null>(null)
  const [invalidZone, setInvalidZone] = useState<string | null>(null)
  const [apiStatus, setApiStatus] = useState<boolean | null>(null)

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
  const zones = ["holding", "Zone 1", "Zone 2", "Zone 3", "Zone 4", "Zone 5"]
  const lanes = ["Lane 1", "Lane 2", "Lane 3", "Lane 4", "Lane 5"]

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

  const isValidMove = (sourceZone: string, destinationZone: string) => {
    // Allow moving from any zone back to the holding zone
    if (destinationZone === "holding") return true

    // Allow moving from holding zone to Zone 1
    if (sourceZone === "holding" && destinationZone === "Zone 1") return true

    const sourceIndex = zones.indexOf(sourceZone)
    const destIndex = zones.indexOf(destinationZone)

    // Can only move to adjacent zones (next or previous)
    return Math.abs(sourceIndex - destIndex) === 1
  }

  const handleDragStart = (start: any) => {
    const { draggableId } = start

    // Store positions of all cards
    document.querySelectorAll("[data-rbd-draggable-id]").forEach((el) => {
      const id = el.getAttribute("data-rbd-draggable-id")
      if (id) {
        cardPositionsRef.current.set(id, el.getBoundingClientRect())
      }
    })
  }

  const handleDragEnd = async (result: any) => {
    const { source, destination, draggableId } = result

    // Find the card that was dragged
    const draggedCard = cards.find((card) => card.id === draggableId)
    if (!draggedCard) return

    // Get original position
    const originalPosition = cardPositionsRef.current.get(draggableId)

    // Dropped outside a droppable area or invalid move
    if (!destination || !isValidMove(source.droppableId.split("-")[0], destination.droppableId.split("-")[0])) {
      // Show red glow if dropped in invalid zone
      if (destination) {
        const destZoneId = destination.droppableId.split("-")[0]
        setInvalidZone(destZoneId)
        setTimeout(() => setInvalidZone(null), 1000)
      }

      // Create ghost card for animation
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

      return
    }

    const sourceZoneId = source.droppableId.split("-")[0]
    const destZoneId = destination.droppableId.split("-")[0]
    const destLaneId = destination.droppableId.split("-")[1]

    // Update card position
    const updatedCards = cards.map((card) => {
      if (card.id === draggableId) {
        // If moving to holding zone, clear the API message
        if (destZoneId === "holding") {
          setApiMessage("")
          return { ...card, zone: "holding", lane: destLaneId }
        }

        // Only set processing state and call API if not moving to holding zone
        // Set processing state
        setProcessingCard({ id: card.id, zone: destZoneId, lane: `Lane ${destLaneId}` })

        // Trigger zone glow effect
        setGlowingZone(destZoneId)
        setTimeout(() => setGlowingZone(null), 1000)

        // Call API and update message
        processVoice({
          cardName: card.content,
          zoneName: destZoneId,
          laneName: `Lane ${destLaneId}`
        }).then((message) => {
          setApiMessage(message)
          // Clear processing state after API call completes
          setProcessingCard({ id: null, zone: null, lane: null })
        }).catch((error) => {
          // Handle API errors
          setApiMessage(`Error: ${error.message}`)
          setProcessingCard({ id: null, zone: null, lane: null })
        })

        return { ...card, zone: destZoneId, lane: `Lane ${destLaneId}` }
      }
      return card
    })

    setCards(updatedCards)
  }

  return (
    <div className="container mx-auto p-4 max-w-6xl">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Voice Manipulation UI</h1>
        <div className="flex items-center space-x-2">
          <span className="text-sm font-medium">API Status:</span>
          {apiStatus === null && <Loader2 className="h-5 w-5 animate-spin text-gray-500" />}
          {apiStatus === true && <CheckCircle className="h-5 w-5 text-green-500" />}
          {apiStatus === false && <XCircle className="h-5 w-5 text-red-500" />}
        </div>
      </div>

      {apiMessage && (
        <div className="mb-6 p-4 bg-slate-100 rounded-lg">
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
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-2">Holding Zone</h2>
          <div className="grid grid-cols-5 gap-4">
            {lanes.map((lane, laneIndex) => (
              <Droppable key={`holding-${laneIndex + 1}`} droppableId={`holding-${laneIndex + 1}`}>
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="min-h-[100px] bg-slate-50 rounded-lg p-2 flex items-center justify-center"
                  >
                    {cards.map((card, index) => {
                      if (card.zone === "holding" && card.lane === (laneIndex + 1).toString()) {
                        return (
                          <Draggable key={card.id} draggableId={card.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className="w-full"
                                style={{
                                  ...provided.draggableProps.style,
                                }}
                              >
                                <Card className="p-3 bg-white shadow-md">
                                  <p className="font-medium">{card.content}</p>
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
            ))}
          </div>
        </div>

        {/* Main Board Zones */}
        <div className="space-y-6">
          {zones.slice(1).map((zone, zoneIndex) => (
            <div key={zone} className="space-y-2">
              <h2 className="text-xl font-semibold">{zone}</h2>
              <div
                className={cn(
                  "grid grid-cols-5 gap-4 transition-all duration-300",
                  glowingZone === zone && "ring-4 ring-yellow-300 rounded-lg",
                  invalidZone === zone && "ring-4 ring-red-500 rounded-lg",
                )}
              >
                {lanes.map((lane, laneIndex) => (
                  <Droppable key={`${zone}-${laneIndex + 1}`} droppableId={`${zone}-${laneIndex + 1}`}>
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="min-h-[100px] bg-slate-100 rounded-lg p-2 relative"
                      >
                        <div className="absolute top-1 left-1 text-xs text-slate-500">{lane}</div>
                        {cards.map((card, index) => {
                          if (card.zone === zone && card.lane === lane) {
                            return (
                              <Draggable key={card.id} draggableId={card.id} index={index}>
                                {(provided, snapshot) => (
                                  <div
                                    ref={provided.innerRef}
                                    {...provided.draggableProps}
                                    {...provided.dragHandleProps}
                                    className="mt-4"
                                    style={{
                                      ...provided.draggableProps.style,
                                    }}
                                  >
                                    <Card
                                      className={cn(
                                        "p-3 bg-white shadow-md relative",
                                        processingCard.id === card.id && "opacity-70",
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
                ))}
              </div>
            </div>
          ))}
        </div>
      </DragDropContext>
    </div>
  )
}

"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd"
import { Card } from "@/components/ui/card"
import { Loader2, CheckCircle, XCircle, Volume2 } from "lucide-react"
import { cn, isLaneSticky, isLaneBlocking, getLaneNumber, getZoneNumber, showStickyIndicators, showBlockingIndicators } from "@/lib/utils"
import { checkApiStatus, processVoice, playAudio, MetadataItem, ProcessResponse } from "@/lib/api-client"
import { MasterDetailsSection } from "@/components/ui/master-details"
import { ZoneSeparator } from "@/components/ui/zone-separator"
import { DebugPanel } from "@/components/ui/debug-panel"
import { 
  AlertDialog, 
  AlertDialogAction, 
  AlertDialogContent, 
  AlertDialogDescription, 
  AlertDialogFooter, 
  AlertDialogHeader, 
  AlertDialogTitle 
} from "@/components/ui/alert-dialog"

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
  // Count of total voices in the system
  const totalVoices = 3;
  
  // Initial cards in the holding zone (one voice per lane)
  const initialCards: CardType[] = [
    { id: "voice-1", content: "Voice 1", zone: "holding", lane: "Lane 1", asFarAsCanGo: false },
    { id: "voice-2", content: "Voice 2", zone: "holding", lane: "Lane 2", asFarAsCanGo: false },
    { id: "voice-3", content: "Voice 3", zone: "holding", lane: "Lane 3", asFarAsCanGo: false },
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
  
  // State to track which card is being hovered over
  const [hoveredCard, setHoveredCard] = useState<string | null>(null)
  
  // Single audio element for the entire application
  // Using a single audio element that we reuse is more reliable
  const audioElement = useRef<HTMLAudioElement | null>(null)
  
  // State for dialogs
  const [showErrorDialog, setShowErrorDialog] = useState<boolean>(false)
  const [errorDialogMessage, setErrorDialogMessage] = useState<string>("")
  const [showSuccessDialog, setShowSuccessDialog] = useState<boolean>(false)
  const [showResetDialog, setShowResetDialog] = useState<boolean>(false)
  const [resetCountdown, setResetCountdown] = useState<number>(10)
  const [showStartDialog, setShowStartDialog] = useState<boolean>(true) // Show start dialog by default
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false)
  
  // Initialize the audio element after user interaction - improved reliability
  const initAudio = useCallback(() => {
    // Create a single audio element that we'll reuse
    if (!audioElement.current) {
      // Create new audio element
      audioElement.current = new Audio();
      
      // Configure properties
      audioElement.current.autoplay = false; // Don't autoplay on src change
      audioElement.current.preload = 'auto'; // Preload audio when possible
      
      // Function for event listener cleanup
      const cleanupAudioListeners = () => {
        if (audioElement.current) {
          audioElement.current.removeEventListener('ended', handleAudioEnded);
          audioElement.current.removeEventListener('error', handleAudioError);
          audioElement.current.removeEventListener('play', handleAudioPlay);
          audioElement.current.removeEventListener('pause', handleAudioPause);
        }
      };
      
      // Define event handlers outside of addEventListener to allow cleanup
      const handleAudioEnded = () => {
        console.log('Audio playback completed');
        setPlayingAudio(null);
      };
      
      const handleAudioError = (e: Event) => {
        console.error('Audio playback error:', e);
        setPlayingAudio(null);
      };
      
      const handleAudioPlay = () => {
        console.log('Audio playback started');
      };
      
      const handleAudioPause = () => {
        console.log('Audio playback paused');
      };
      
      // Set up event listeners with proper cleanup
      audioElement.current.addEventListener('ended', handleAudioEnded);
      audioElement.current.addEventListener('error', handleAudioError);
      audioElement.current.addEventListener('play', handleAudioPlay);
      audioElement.current.addEventListener('pause', handleAudioPause);
      
      // Register cleanup as a property on the audio element to allow cleanup in other functions
      (audioElement.current as any).cleanup = cleanupAudioListeners;
      
      console.log('Audio element and listeners initialized');
    }
    
    setAudioEnabled(true);
  }, [])

  // Audio cleanup effect to prevent memory leaks
  useEffect(() => {
    // Return cleanup function
    return () => {
      // If we have an audio element with a cleanup function, call it
      if (audioElement.current && (audioElement.current as any).cleanup) {
        (audioElement.current as any).cleanup();
      }
      
      // If we have an audio element, pause it and nullify
      if (audioElement.current) {
        try {
          audioElement.current.pause();
          audioElement.current.src = '';
        } catch (e) {
          console.log("Error cleaning up audio element:", e);
        }
      }
    };
  }, []);
  
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
  
  // Internal lane identifiers (used for logic - don't change these)
  const lanes = ["Lane 1", "Lane 2", "Lane 3"]
  
  // Display names for lanes (cosmetic only - customize these)
  const laneDisplayNames = {
    "holding": {
      "Lane 1": "Lane 1",
      "Lane 2": "Lane 2", 
      "Lane 3": "Lane 3"
    },
    "Zone 1": {
      "Lane 1": "High",
      "Lane 2": "Raspy", 
      "Lane 3": "Low"
    },
    "Zone 2": {
      "Lane 1": "Fast",
      "Lane 2": "Slow", 
      "Lane 3": "Hesitant"
    },
    "Zone 3": {
      "Lane 1": "Corporate",
      "Lane 2": "Artspeak", 
      "Lane 3": "Gen-Z"
    },
    "Zone 4": {
      "Lane 1": "American",
      "Lane 2": "Italian", 
      "Lane 3": "Albanian"
    }
  }

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
  
  // Reset timer effect
  useEffect(() => {
    if (showResetDialog) {
      // Start countdown from 10
      setResetCountdown(10);
      
      // Set up interval to decrement the counter
      const interval = setInterval(() => {
        setResetCountdown(prev => {
          // When we reach 0, reload the page
          if (prev <= 1) {
            clearInterval(interval);
            window.location.reload();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      // Clean up interval on unmount
      return () => clearInterval(interval);
    }
  }, [showResetDialog]);
  
  // Global mouse move listener to detect when mouse leaves a card - using more reliable approach
  useEffect(() => {
    // Only set up if audio is enabled
    if (!audioEnabled) return;
    
    // Create a new AbortController for each listener setup
    const controller = new AbortController();
    const signal = controller.signal;
    
    const handleMouseMove = (e: MouseEvent) => {
      // If we have a hovered card and audio is playing
      if (hoveredCard && playingAudio && hoveredCard === playingAudio) {
        // Get the card element
        const cardElement = document.querySelector(`[data-rbd-draggable-id="${hoveredCard}"]`);
        if (!cardElement) return;
        
        // Get card position
        const rect = cardElement.getBoundingClientRect();
        
        // Add a small buffer zone around the card (5px) to prevent flicker at the edges
        const bufferZone = 5;
        
        // Check if mouse is outside the card with buffer
        const isOutside = 
          e.clientX < (rect.left - bufferZone) || 
          e.clientX > (rect.right + bufferZone) || 
          e.clientY < (rect.top - bufferZone) || 
          e.clientY > (rect.bottom + bufferZone);
        
        // If mouse is outside the card and audio is playing
        if (isOutside && audioElement.current) {
          console.log('Mouse outside card bounds, stopping audio');
          
          // Implement a small debounce to prevent flicker at boundaries
          // Use requestAnimationFrame for better performance
          requestAnimationFrame(() => {
            // Check again if we're still outside (helps with quick mouse movements)
            const newRect = cardElement.getBoundingClientRect();
            const isStillOutside = 
              e.clientX < (newRect.left - bufferZone) || 
              e.clientX > (newRect.right + bufferZone) || 
              e.clientY < (newRect.top - bufferZone) || 
              e.clientY > (newRect.bottom + bufferZone);
              
            if (isStillOutside && audioElement.current) {
              try {
                audioElement.current.pause();
                audioElement.current.currentTime = 0;
              } catch (err) {
                console.log("Pause error on mouse leave (suppressed):", err);
              }
              setPlayingAudio(null);
              setHoveredCard(null);
            }
          });
        }
      }
    };
    
    // Add the event listener with the AbortController signal
    document.addEventListener('mousemove', handleMouseMove, { signal });
    
    // Remove on cleanup using AbortController
    return () => controller.abort();
  }, [audioEnabled, hoveredCard, playingAudio]);
  
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
    
    // Check if any cards are in Zone 4 Lane 1 - special case completion
    const isAnyCardInZone4Lane1 = cards.some(card => 
      card.zone === "Zone 4" && card.lane === "Lane 1"
    );
    
    // If any card is in Zone 4 Lane 1, count all voices as complete for Zone 4
    // Otherwise, use the normal historical count
    const zone4CompletionCount = isAnyCardInZone4Lane1 ? totalVoices : zone4HistoricalCount;
    
    // Update zone completion counts based on historical presence
    setZoneCompletions({
      "Zone 1": zone1HistoricalCount,
      "Zone 2": zone2HistoricalCount,
      "Zone 3": zone3HistoricalCount,
      "Zone 4": zone4CompletionCount
    });
  }, [historicalZonePresence, cards, totalVoices]);
  
  // Separate effect to update zone visibility based on zone completions and card positions
  useEffect(() => {
    const zone1HistoricalCount = historicalZonePresence["Zone 1"].size;
    const zone2HistoricalCount = historicalZonePresence["Zone 2"].size;
    const zone3HistoricalCount = historicalZonePresence["Zone 3"].size;
    
    // Check if all cards have reached as far as they can go
    const allCardsAtMaxPosition = cards.every(card => card.asFarAsCanGo === true);
    
    // SPECIAL RULE FOR ZONE 1: Count how many cards are currently in Zone 1
    const cardsInZone1 = cards.filter(card => card.zone === "Zone 1").length;
    const allLanesInZone1Occupied = cardsInZone1 === lanes.length; // If all lanes are filled
    
    // For Zone 1 specifically, reveal Zone 2 when all lanes are occupied, regardless of asFarAsCanGo
    if (!zoneVisibility["Zone 2"] && allLanesInZone1Occupied) {
      console.log("Special Zone 1 rule: All lanes occupied, revealing Zone 2");
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
    // Use the normal rule for Zone 1 as a fallback
    else if (zone1HistoricalCount > 0 && allCardsAtMaxPosition && !zoneVisibility["Zone 2"]) {
      console.log("Standard rule: All cards at max position, revealing Zone 2");
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
    
    // Standard rules for Zones 2 and 3
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
  }, [cards, zoneVisibility, historicalZonePresence, lanes.length]);

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
    
    // Get zone indices
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
    
    // Can only move to the next zone (forward), not to previous zones
    // This prevents backward movement between processing zones
    if (sourceZone !== "holding" && destinationZone !== "holding") {
      return destIndex === sourceIndex + 1
    }
    
    // For other cases (mainly holding zone interactions), check if zones are adjacent
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
    
    // Reset hover state when dragging starts
    setHoveredCard(null);
    setPlayingAudio(null);
    
    // Stop any currently playing audio with enhanced error handling
    if (audioElement.current) {
      try {
        // Check if audio is actually playing before calling pause
        if (!audioElement.current.paused) {
          audioElement.current.pause();
        }
        // Always reset position for consistent behavior
        audioElement.current.currentTime = 0;
      } catch (e) {
        console.log("Pause error in handleDragStart (suppressed):", e);
      }
      setPlayingAudio(null);
    }
  }
  
  // Play audio for a card using improved reliability
  const playAudioForCard = async (card: CardType) => {
    if (!audioEnabled || !audioElement.current) return;
    
    // Only play audio for cards that are in a zone
    if (!card.zone) return;
    
    // Skip if a card is still processing
    if (processingCard.id === card.id) return;
    
    setApiMessage(`Loading ${card.content} audio...`);
    
    try {
      // Call API to get audio URL
      const response = await processVoice({
        cardName: card.content,
        zoneName: card.zone,
        laneName: card.lane
      });
      
      // Check if the API call was successful
      if (response.status === "error") {
        throw new Error(response.message || "API returned an error");
      }
      
      // Play the audio if available
      if (response.audioFile) {
        setApiMessage(`Playing ${card.content}...`);
        
        // Cache check for better performance - check if URL has changed
        const isSameAudio = audioElement.current.src === response.audioFile;
        
        if (!isSameAudio) {
          // Use our improved audio play function
          safePlayAudio(response.audioFile, card.id);
        } else {
          // If it's the same audio file we already loaded, just restart playback
          // for better performance
          if (audioElement.current.paused || audioElement.current.ended) {
            audioElement.current.currentTime = 0;
            audioElement.current.play()
              .then(() => {
                setPlayingAudio(card.id);
              })
              .catch(playError => {
                console.log("Play error (suppressed):", playError);
              });
          }
        }
      } else {
        setApiMessage(`No audio file returned for ${card.content}`);
      }
    } catch (error) {
      console.error("Audio API error:", error);
      setApiMessage(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  
  // Improved safe play function with better error handling and performance
  const safePlayAudio = (url: string, cardId: string) => {
    if (!audioElement.current) return;
    
    try {
      // First pause current audio without triggering errors
      try {
        // Check if the audio is actually playing before pausing
        if (!audioElement.current.paused) {
          audioElement.current.pause();
        }
        // Always reset position
        audioElement.current.currentTime = 0;
      } catch (pauseError) {
        console.log("Pause error (suppressed):", pauseError);
      }
      
      // Clean up any existing event listeners to prevent memory leaks
      if ((audioElement.current as any).cleanup) {
        (audioElement.current as any).cleanup();
      }
      
      // Set new source instead of recreating the entire element
      // This is more efficient and prevents memory leaks
      audioElement.current.src = url;
      
      // Function for event listener cleanup - recreate for this instance
      const cleanupAudioListeners = () => {
        if (audioElement.current) {
          audioElement.current.removeEventListener('ended', handleAudioEnded);
          audioElement.current.removeEventListener('error', handleAudioError);
          audioElement.current.removeEventListener('play', handleAudioPlay);
          audioElement.current.removeEventListener('pause', handleAudioPause);
        }
      };
      
      // Define event handlers outside of addEventListener to allow cleanup
      const handleAudioEnded = () => {
        console.log('Audio playback completed');
        setPlayingAudio(null);
      };
      
      const handleAudioError = (e: Event) => {
        console.error('Audio playback error:', e);
        setPlayingAudio(null);
      };
      
      const handleAudioPlay = () => {
        console.log('Audio playback started');
      };
      
      const handleAudioPause = () => {
        console.log('Audio playback paused');
      };
      
      // Set up event listeners with proper cleanup
      audioElement.current.addEventListener('ended', handleAudioEnded);
      audioElement.current.addEventListener('error', handleAudioError);
      audioElement.current.addEventListener('play', handleAudioPlay);
      audioElement.current.addEventListener('pause', handleAudioPause);
      
      // Register cleanup function for later use
      (audioElement.current as any).cleanup = cleanupAudioListeners;
      
      // Use error handling for play with proper promise handling
      audioElement.current.play().then(() => {
        console.log('Audio playback started successfully');
        setPlayingAudio(cardId);
      }).catch(playError => {
        // Handle play errors without throwing to NextJS error handler
        console.log("Play error (suppressed):", playError);
        
        // Some browsers require user interaction to play audio
        // If we get a play error, we'll update the UI but not crash
        setApiMessage("Audio play requires interaction. Please click first.");
      });
    } catch (error) {
      // Handle any other errors without throwing to NextJS
      console.log("Audio setup error (suppressed):", error);
    }
  };
  
  // Handle mouse enter (hover) on a card using a more reliable approach
  const handleCardHover = (card: CardType) => {
    // Don't do anything if we're already hovering over this card
    if (hoveredCard === card.id) return;
    
    // Update hover state
    setHoveredCard(card.id);
    
    // Play audio for this card if enabled
    if (audioEnabled) {
      playAudioForCard(card);
    }
  };

  // Handle mouse leave with better reliability
  const handleCardLeave = () => {
    // Clear hover state
    setHoveredCard(null);
    
    // Pause audio when leaving a card
    if (audioElement.current) {
      try {
        audioElement.current.pause();
        // Reset position to beginning for next play
        audioElement.current.currentTime = 0;
      } catch (e) {
        console.log("Pause error in handleCardLeave (suppressed):", e);
      }
    }
    
    setPlayingAudio(null);
  };

  // Handle clicking a card
  const handleCardClick = (card: CardType) => {
    // Select the card to show its details in the master details panel regardless of zone
    setSelectedVoiceCard(card.content);
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
      
      // Determine the type of invalid move and show appropriate error message
      if (sourceLaneName) {
        const laneNumber = getLaneNumber(sourceLaneName)
        const sourceZoneNum = getZoneNumber(sourceZoneId)
        const destZoneNum = destZoneId ? getZoneNumber(destZoneId) : 0
        
        if (isLaneSticky(sourceZoneId, laneNumber)) {
          // Sticky lane case - show specific hint that they're completely stuck with this style
          
          // Get the display name for the current lane
          const laneDisplayName = laneDisplayNames[sourceZoneId]?.[sourceLaneName] || sourceLaneName;
          
          // Build the error message with the lane display name
          setErrorDialogMessage(`Unfortunately you chose "${laneDisplayName}". The selected voice is now stuck with this speaking style. Try moving the other voices instead.`)
          setShowErrorDialog(true)
        } 
        else if (isLaneBlocking(sourceZoneId, laneNumber) && destZoneNum > sourceZoneNum) {
          // Blocking lane case - show specific hint based on the zone
          
          // Get the display name for the current lane
          const laneDisplayName = laneDisplayNames[sourceZoneId]?.[sourceLaneName] || sourceLaneName;
          
          // Different hint messages based on the current zone
          let hintMessage = "";
          if (sourceZoneId === "Zone 1") {
            hintMessage = "Try another pitch type";
          } else if (sourceZoneId === "Zone 2") {
            hintMessage = "Try another talking speed";
          } else if (sourceZoneId === "Zone 3") {
            hintMessage = "Try another type of jargon";
          }
          
          // Build the error message
          setErrorDialogMessage(`Pass Denied. The "${laneDisplayName}" style prevents this voice from advancing. ${hintMessage}.`)
          setShowErrorDialog(true)
        }
        else if (sourceZoneId !== "holding" && destZoneId !== "holding" && destZoneNum < sourceZoneNum) {
          // Attempting to move backward between processing zones
          setErrorDialogMessage("Can't go backwards, only forwards")
          setShowErrorDialog(true)
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
        
        // Show success dialog when a card is placed in Lane 1 of Zone 4
        if (destZoneId === "Zone 4" && destLaneName === "Lane 1") {
          setTimeout(() => {
            setShowSuccessDialog(true)
          }, 1000) // Show after processing animation completes
        }

        // Call API and process response
        processVoice({
          cardName: card.content,
          zoneName: destZoneId,
          laneName: destLaneName,
          previousZone: sourceZoneId
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
          
          // Play audio if available and enabled
          if (response.audioFile && audioEnabled) {
            // Use a slight delay to ensure the card has fully settled at its new position
            // This helps prevent the audio from playing and then immediately stopping
            // if the mouse isn't over the card after drop
            setTimeout(() => {
              // Check if mouse is still over the card after drop and positioning is complete
              const cardElement = document.querySelector(`[data-rbd-draggable-id="${card.id}"]`);
              if (cardElement) {
                const rect = cardElement.getBoundingClientRect();
                const isMouseOverCard = 
                  mousePosition.x >= rect.left && 
                  mousePosition.x <= rect.right && 
                  mousePosition.y >= rect.top && 
                  mousePosition.y <= rect.bottom;
                
                if (isMouseOverCard) {
                  // Play audio on drag completion using our safe function
                  safePlayAudio(response.audioFile, card.id);
                }
              }
            }, 100);
          }
          
          // Clear processing state after API call completes
          setProcessingCard({ id: null, zone: null, lane: null })
          
          // After processing, check if the mouse is really still over the card
          // We need to manually check because the drag event may not trigger mouse events correctly
          setTimeout(() => {
            // Get the card element
            const cardElement = document.querySelector(`[data-rbd-draggable-id="${card.id}"]`);
            if (!cardElement) return;
            
            // Get card position
            const rect = cardElement.getBoundingClientRect();
            
            // Check if the mouse is really over the card
            const isMouseOverCard = 
              mousePosition.x >= rect.left && 
              mousePosition.x <= rect.right && 
              mousePosition.y >= rect.top && 
              mousePosition.y <= rect.bottom;
            
            console.log('Mouse position check:', mousePosition.x, mousePosition.y, 'Card rect:', rect, 'Is over:', isMouseOverCard);
            
            // If mouse is not over the card, stop the audio
            if (!isMouseOverCard && playingAudio === card.id && audioElement.current) {
              console.log('Mouse not over card after drop, stopping audio');
              audioElement.current.pause();
              setPlayingAudio(null);
              setHoveredCard(null);
            }
          }, 100); // Small delay to ensure DOM is updated
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
    <div className="flex h-screen overflow-hidden bg-[#3730A3] text-white" style={{ minWidth: "100vw" }}>
      {/* Start Dialog to Enable Audio */}
      <AlertDialog open={showStartDialog} onOpenChange={setShowStartDialog}>
        <AlertDialogContent className="bg-indigo-900 text-white border-indigo-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-xl">Welcome to Voice Box Bias</AlertDialogTitle>
            <AlertDialogDescription className="text-white/90">
              Click &quot;Start Experience&quot; to enable audio playback on hover. 
              Cards will play their voice when you hover over them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => {
                setShowStartDialog(false);
                initAudio(); // Initialize audio system on user interaction
              }}
            >
              Start Experience
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Error Dialog */}
      <AlertDialog open={showErrorDialog} onOpenChange={setShowErrorDialog}>
        <AlertDialogContent className="bg-red-900 text-white border-red-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-xl">Pass Denied</AlertDialogTitle>
            <AlertDialogDescription className="text-white/90">
              {errorDialogMessage}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              className="bg-red-700 hover:bg-red-800 text-white"
              onClick={() => setShowErrorDialog(false)}
            >
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Success Dialog */}
      <AlertDialog open={showSuccessDialog} onOpenChange={(open) => {
        setShowSuccessDialog(open);
        // When the success dialog is closed, show the reset dialog
        if (!open) {
          setShowResetDialog(true);
        }
      }}>
        <AlertDialogContent className="bg-green-800 text-white border-green-600">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-xl">Mission accomplished</AlertDialogTitle>
            <AlertDialogDescription className="text-white/90">
              Thank you for helping to train the bias
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction 
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setShowSuccessDialog(false)}
            >
              Close
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Reset Dialog with countdown */}
      <AlertDialog open={showResetDialog} onOpenChange={() => {/* Do nothing - user can't close this */}}>
        <AlertDialogContent className="bg-blue-900 text-white border-blue-700">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-white text-xl">Game Complete</AlertDialogTitle>
            {/* Use a div instead of AlertDialogDescription to avoid p > div nesting issue */}
            <div className="text-white/90 text-center py-4">
              <p className="text-2xl mb-3">Resetting the game in {resetCountdown} seconds</p>
              <div className="w-full bg-blue-800 rounded-full h-4 mb-4">
                <div 
                  className="bg-green-500 h-4 rounded-full transition-all duration-1000 ease-linear" 
                  style={{ width: `${(resetCountdown / 10) * 100}%` }}
                ></div>
              </div>
            </div>
          </AlertDialogHeader>
        </AlertDialogContent>
      </AlertDialog>
      
      {/* Main scrollable content area - fixed at 70% with minimum width */}
      <div className="w-[70%] overflow-y-auto p-4 main-pane" style={{ minWidth: "70%", maxWidth: "70%" }}>
        <div className="mb-6 flex justify-between items-center max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold">VOCAL BOX BIAS</h1>
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium">API Status:</span>
            {apiStatus === null && <Loader2 className="h-5 w-5 animate-spin text-gray-300" />}
            {apiStatus === true && <CheckCircle className="h-5 w-5 text-green-300" />}
            {apiStatus === false && <XCircle className="h-5 w-5 text-red-300" />}
          </div>
        </div>
        
        <div className="max-w-4xl mx-auto">
          <p className="text-lg mb-8">
            Pick up the voices and place them in one of the boxes
          </p>

          {/* Status message panel (commented out for now, can be re-enabled later)
          {apiMessage && (
            <div className="mb-6 p-4 bg-indigo-700 rounded-lg border border-indigo-600">
              <p>{apiMessage}</p>
            </div>
          )}
          */}
        </div>

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
          <div className="mb-4 max-w-4xl mx-auto">
            <h2 className="text-xl font-semibold mb-4 pl-0.5">Starting Zone</h2>
            <div className="flex flex-row justify-between w-full">
              {lanes.map((lane, laneIndex) => (
                <div key={`holding-lane-${laneIndex + 1}`} className="w-[calc(33.33%-0.75rem)]">
                  <div className="flex items-center mb-2">
                    <div className="text-sm font-medium text-white bg-indigo-900 inline-block p-1 rounded">
                      {laneDisplayNames["holding"][lane]}
                    </div>
                  </div>
                  <Droppable 
                    key={`holding-${laneIndex + 1}`} 
                    droppableId={`holding-${laneIndex + 1}`} 
                    direction="horizontal"
                  >
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        style={{ 
                          backgroundColor: '#3037AB', // Same as the background color
                          width: '100%',
                          height: '200px',
                          borderRadius: '0.5rem',
                          padding: '0.5rem',
                          display: 'flex',
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          overflowX: 'auto',
                          boxShadow: glowingZone === "holding" ? '0 0 0 4px #fcd34d' : 
                                     invalidZone === "holding" ? '0 0 0 4px #ef4444' : 'none'
                        }}
                      >
                        {cards.map((card, index) => {
                          if (card.zone === "holding" && card.lane === lane) {
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
                                    onMouseEnter={() => handleCardHover(card)}
                                    onMouseLeave={handleCardLeave}
                                  >
                                    <Card className={cn(
                                      "p-3 bg-amber-300 shadow-md relative cursor-pointer hover:ring-2 hover:ring-green-300 w-32 h-32 text-gray-800 flex flex-col justify-between",
                                      (playingAudio === card.id || hoveredCard === card.id) && "ring-2 ring-green-500"
                                    )}>
                                      <div className="flex flex-col items-center justify-center">
                                        <p className="font-medium text-center">{card.content}</p>
                                        <Volume2 className="h-4 w-4 text-blue-500 mt-2" />
                                      </div>
                                      <p className="text-xs text-gray-700 text-center">
                                        Hover to play
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
              ))}
            </div>
          </div>
          
          {/* Wall between Holding Zone and Zone 1 */}
          <ZoneSeparator color="purple" />

          {/* Zone 1 */}
          {zoneVisibility["Zone 1"] && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xl font-semibold mb-4 pl-0.5">Pitch</h2>
              <div className="flex flex-row justify-between w-full">
                {lanes.map((lane, laneIndex) => (
                  <div key={`Zone 1-lane-${laneIndex + 1}`} className="w-[calc(33.33%-0.75rem)]">
                    <div className="flex items-center mb-2">
                      <div className={`text-sm font-medium text-white bg-indigo-900 inline-block p-1 rounded
                        ${isLaneSticky("Zone 1", laneIndex + 1) && showStickyIndicators() ? 'border-2 border-red-500' : 
                          isLaneBlocking("Zone 1", laneIndex + 1) && showBlockingIndicators() ? 'border-2 border-orange-500' : ''}`}>
                        {laneDisplayNames["Zone 1"][lane]}
                        {isLaneSticky("Zone 1", laneIndex + 1) && showStickyIndicators() && (
                          <span className="ml-1 text-xs text-red-300">STICKY</span>
                        )}
                        {isLaneBlocking("Zone 1", laneIndex + 1) && !isLaneSticky("Zone 1", laneIndex + 1) && showBlockingIndicators() && (
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
                            backgroundColor: '#FF6464', // All Zone 1 lanes use the same color
                            width: '100%',
                            height: '200px',
                            borderRadius: '0.5rem',
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflowX: 'auto',
                            boxShadow: glowingZone === "Zone 1" ? '0 0 0 4px #fcd34d' : 
                                       invalidZone === "Zone 1" ? '0 0 0 4px #ef4444' : 
                                       isLaneSticky("Zone 1", laneIndex + 1) && showStickyIndicators() ? '0 0 0 3px #ef4444' : 
                                       isLaneBlocking("Zone 1", laneIndex + 1) && showBlockingIndicators() ? '0 0 0 2px #f97316' : 'none',
                            borderTop: isLaneSticky("Zone 1", laneIndex + 1) && showStickyIndicators() ? '3px dashed #ef4444' : 
                                       isLaneBlocking("Zone 1", laneIndex + 1) && showBlockingIndicators() ? '3px dotted #f97316' : 'none',
                            borderBottom: isLaneSticky("Zone 1", laneIndex + 1) && showStickyIndicators() ? '3px dashed #ef4444' :
                                         isLaneBlocking("Zone 1", laneIndex + 1) && showBlockingIndicators() ? '3px dotted #f97316' : 'none'
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
                                      onMouseEnter={() => handleCardHover(card)}
                                      onMouseLeave={handleCardLeave}
                                    >
                                      <Card
                                        className={cn(
                                          "p-3 bg-amber-300 shadow-md relative w-32 h-32 cursor-pointer text-gray-800 flex flex-col justify-center",
                                          processingCard.id === card.id && "opacity-70",
                                          (selectedVoiceCard === card.content || hoveredCard === card.id) && "ring-2 ring-green-500",
                                          card.asFarAsCanGo && "border-b-4 border-purple-600"
                                        )}
                                      >
                                        <p className="font-medium text-center">{card.content}</p>
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
            </div>
          )}

          {/* Wall between Zone 1 and Zone 2 */}
          {zoneVisibility["Zone 2"] && <ZoneSeparator color="amber" />}

          {/* Zone 2 */}
          {zoneVisibility["Zone 2"] && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xl font-semibold mb-4 pl-0.5">Pace</h2>
              <div className="flex flex-row justify-between w-full">
                {lanes.map((lane, laneIndex) => (
                  <div key={`Zone 2-lane-${laneIndex + 1}`} className="w-[calc(33.33%-0.75rem)]">
                    <div className="flex items-center mb-2">
                      <div className={`text-sm font-medium text-white bg-indigo-900 inline-block p-1 rounded
                        ${isLaneSticky("Zone 2", laneIndex + 1) && showStickyIndicators() ? 'border-2 border-red-500' : 
                          isLaneBlocking("Zone 2", laneIndex + 1) && showBlockingIndicators() ? 'border-2 border-orange-500' : ''}`}>
                        {laneDisplayNames["Zone 2"][lane]}
                        {isLaneSticky("Zone 2", laneIndex + 1) && showStickyIndicators() && (
                          <span className="ml-1 text-xs text-red-300">STICKY</span>
                        )}
                        {isLaneBlocking("Zone 2", laneIndex + 1) && !isLaneSticky("Zone 2", laneIndex + 1) && showBlockingIndicators() && (
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
                            backgroundColor: '#067429', // All Zone 2 lanes use the same color
                            width: '100%',
                            height: '200px',
                            borderRadius: '0.5rem',
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflowX: 'auto',
                            boxShadow: glowingZone === "Zone 2" ? '0 0 0 4px #fcd34d' : 
                                       invalidZone === "Zone 2" ? '0 0 0 4px #ef4444' : 
                                       isLaneSticky("Zone 2", laneIndex + 1) && showStickyIndicators() ? '0 0 0 3px #ef4444' : 
                                       isLaneBlocking("Zone 2", laneIndex + 1) && showBlockingIndicators() ? '0 0 0 2px #f97316' : 'none',
                            borderTop: isLaneSticky("Zone 2", laneIndex + 1) && showStickyIndicators() ? '3px dashed #ef4444' : 
                                       isLaneBlocking("Zone 2", laneIndex + 1) && showBlockingIndicators() ? '3px dotted #f97316' : 'none',
                            borderBottom: isLaneSticky("Zone 2", laneIndex + 1) && showStickyIndicators() ? '3px dashed #ef4444' :
                                          isLaneBlocking("Zone 2", laneIndex + 1) && showBlockingIndicators() ? '3px dotted #f97316' : 'none'
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
                                      onMouseEnter={() => handleCardHover(card)}
                                      onMouseLeave={handleCardLeave}
                                    >
                                      <Card
                                        className={cn(
                                          "p-3 bg-green-300 shadow-md relative w-32 h-32 cursor-pointer text-gray-800 flex flex-col justify-center",
                                          processingCard.id === card.id && "opacity-70",
                                          (selectedVoiceCard === card.content || hoveredCard === card.id) && "ring-2 ring-green-500",
                                          card.asFarAsCanGo && "border-b-4 border-purple-600"
                                        )}
                                      >
                                        <p className="font-medium text-center">{card.content}</p>
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
            </div>
          )}

          {/* Wall between Zone 2 and Zone 3 */}
          {zoneVisibility["Zone 3"] && <ZoneSeparator color="green" />}

          {/* Zone 3 */}
          {zoneVisibility["Zone 3"] && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xl font-semibold mb-4 pl-0.5">Jargon</h2>
              <div className="flex flex-row justify-between w-full">
                {lanes.map((lane, laneIndex) => (
                  <div key={`Zone 3-lane-${laneIndex + 1}`} className="w-[calc(33.33%-0.75rem)]">
                    <div className="flex items-center mb-2">
                      <div className={`text-sm font-medium text-white bg-indigo-900 inline-block p-1 rounded
                        ${isLaneSticky("Zone 3", laneIndex + 1) && showStickyIndicators() ? 'border-2 border-red-500' : 
                          isLaneBlocking("Zone 3", laneIndex + 1) && showBlockingIndicators() ? 'border-2 border-orange-500' : ''}`}>
                        {laneDisplayNames["Zone 3"][lane]}
                        {isLaneSticky("Zone 3", laneIndex + 1) && showStickyIndicators() && (
                          <span className="ml-1 text-xs text-red-300">STICKY</span>
                        )}
                        {isLaneBlocking("Zone 3", laneIndex + 1) && !isLaneSticky("Zone 3", laneIndex + 1) && showBlockingIndicators() && (
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
                            backgroundColor: '#FFFFFF', // All Zone 3 lanes use the same color
                            width: '100%',
                            height: '200px',
                            borderRadius: '0.5rem',
                            padding: '0.5rem',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'center',
                            justifyContent: 'center',
                            overflowX: 'auto',
                            boxShadow: glowingZone === "Zone 3" ? '0 0 0 4px #fcd34d' : 
                                       invalidZone === "Zone 3" ? '0 0 0 4px #ef4444' : 
                                       isLaneSticky("Zone 3", laneIndex + 1) && showStickyIndicators() ? '0 0 0 3px #ef4444' : 
                                       isLaneBlocking("Zone 3", laneIndex + 1) && showBlockingIndicators() ? '0 0 0 2px #f97316' : 'none',
                            borderTop: isLaneSticky("Zone 3", laneIndex + 1) && showStickyIndicators() ? '3px dashed #ef4444' : 
                                       isLaneBlocking("Zone 3", laneIndex + 1) && showBlockingIndicators() ? '3px dotted #f97316' : 'none',
                            borderBottom: isLaneSticky("Zone 3", laneIndex + 1) && showStickyIndicators() ? '3px dashed #ef4444' :
                                          isLaneBlocking("Zone 3", laneIndex + 1) && showBlockingIndicators() ? '3px dotted #f97316' : 'none'
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
                                      onMouseEnter={() => handleCardHover(card)}
                                      onMouseLeave={handleCardLeave}
                                    >
                                      <Card
                                        className={cn(
                                          "p-3 bg-blue-300 shadow-md relative w-32 h-32 cursor-pointer text-gray-800 flex flex-col justify-center",
                                          processingCard.id === card.id && "opacity-70",
                                          (selectedVoiceCard === card.content || hoveredCard === card.id) && "ring-2 ring-green-500",
                                          card.asFarAsCanGo && "border-b-4 border-purple-600"
                                        )}
                                      >
                                        <p className="font-medium text-center">{card.content}</p>
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
            </div>
          )}
          
          {/* Wall between Zone 3 and Zone 4 */}
          {zoneVisibility["Zone 4"] && <ZoneSeparator color="blue" />}

          {/* Zone 4 - with custom visual ordering (Lane 2, Lane 3, Lane 1) */}
          {zoneVisibility["Zone 4"] && (
            <div className="max-w-4xl mx-auto">
              <h2 className="text-xl font-semibold mb-4 pl-0.5">Accent</h2>
              <div className="flex flex-row justify-between w-full">
                {/* Custom visual ordering for Zone 4:
                    Visual Left position: Lane 2 (index 1)
                    Visual Middle position: Lane 3 (index 2)
                    Visual Right position: Lane 1 (index 0) */}
                {[
                  { lane: lanes[1], index: 1 }, // Lane 2 (Spanish)
                  { lane: lanes[2], index: 2 }, // Lane 3 (Albanian)
                  { lane: lanes[0], index: 0 }, // Lane 1 (American)
                ].map((laneInfo) => {
                  const lane = laneInfo.lane;
                  const laneIndex = laneInfo.index;
                  return (
                    <div key={`Zone 4-lane-${laneIndex + 1}`} className="w-[calc(33.33%-0.75rem)]">
                      <div className="flex items-center mb-2">
                        <div className={`text-sm font-medium text-white bg-indigo-900 inline-block p-1 rounded
                          ${isLaneSticky("Zone 4", laneIndex + 1) && showStickyIndicators() ? 'border-2 border-red-500' : 
                            isLaneBlocking("Zone 4", laneIndex + 1) && showBlockingIndicators() ? 'border-2 border-orange-500' : ''}`}>
                          {laneDisplayNames["Zone 4"][lane]}
                          {isLaneSticky("Zone 4", laneIndex + 1) && showStickyIndicators() && (
                            <span className="ml-1 text-xs text-red-300">STICKY</span>
                          )}
                          {isLaneBlocking("Zone 4", laneIndex + 1) && !isLaneSticky("Zone 4", laneIndex + 1) && showBlockingIndicators() && (
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
                              backgroundColor: '#595959', // All Zone 4 lanes use the same color
                              width: '100%',
                              height: '200px',
                              borderRadius: '0.5rem',
                              padding: '0.5rem',
                              display: 'flex',
                              flexDirection: 'row',
                              alignItems: 'center',
                              justifyContent: 'center',
                              overflowX: 'auto',
                              boxShadow: glowingZone === "Zone 4" ? '0 0 0 4px #fcd34d' : 
                                         invalidZone === "Zone 4" ? '0 0 0 4px #ef4444' : 
                                         isLaneSticky("Zone 4", laneIndex + 1) && showStickyIndicators() ? '0 0 0 3px #ef4444' : 
                                         isLaneBlocking("Zone 4", laneIndex + 1) && showBlockingIndicators() ? '0 0 0 2px #f97316' : 'none',
                              borderTop: isLaneSticky("Zone 4", laneIndex + 1) && showStickyIndicators() ? '3px dashed #ef4444' : 
                                         isLaneBlocking("Zone 4", laneIndex + 1) && showBlockingIndicators() ? '3px dotted #f97316' : 'none',
                              borderBottom: isLaneSticky("Zone 4", laneIndex + 1) && showStickyIndicators() ? '3px dashed #ef4444' :
                                            isLaneBlocking("Zone 4", laneIndex + 1) && showBlockingIndicators() ? '3px dotted #f97316' : 'none'
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
                                        onMouseEnter={() => handleCardHover(card)}
                                        onMouseLeave={handleCardLeave}
                                      >
                                        <Card
                                          className={cn(
                                            "p-3 bg-pink-300 shadow-md relative w-32 h-32 cursor-pointer text-gray-800 flex flex-col justify-center",
                                            processingCard.id === card.id && "opacity-70",
                                            (selectedVoiceCard === card.content || hoveredCard === card.id) && "ring-2 ring-green-500",
                                            card.asFarAsCanGo && "border-b-4 border-purple-600"
                                          )}
                                        >
                                          <p className="font-medium text-center">{card.content}</p>
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
                  );
                })}
              </div>
            </div>
          )}

          {/* Additional padding at the bottom for scrolling */}
          <div className="h-24 max-w-4xl mx-auto"></div>
        </DragDropContext>
      </div>

      {/* Fixed right sidebar for master details section */}
      <div className="w-[30%] bg-[#3730A3] p-6 overflow-y-auto border-l border-indigo-900 shadow-inner side-pane" style={{ minWidth: "30%", maxWidth: "30%" }}>
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
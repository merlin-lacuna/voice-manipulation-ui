I would like you to create a web app that includes extensive drag and drop functionality. The closest analog to want is a kanban board app where you drag and drop cards into different columns, so let's use that as our mental model for now.

But there are a few differences from a regular kanban board app that I want to go into now:

* Instead of going from left-to-right the so-called “board” will go from top-to-bottom.  
* Thus, instead of “columns” we will have “rows” called “Zones”.  
  * There should be 5 of them, labelled “Zone 1”, “Zone 2”, and so on…  
* There should also be “swimlanes” but these will be represented as vertical column boundaries.  
  * There should be 5 of these too, they should be labelled “Lane 1”, “Lane 2” and so on.  
* There should be 5 cards that sit in a “holding zone” outside of the “board” at the top of the page, they should be lined up in a row, with the same spacing as the “lanes”. 

* The cards should be labelled “Voice A”, “Voice B”, “Voice C”, “Voice D”, “Voice E”.  
*  I can take any one of the cards & drag them into the first Zone, into any of the 5 Lanes.  
*  I cannot drag any card from the “holding zone” into Zone 2, 3, 4, or 5, only Zone 1\.  
* To drag a card into the next Zone, it has to be dragged from the directly preceding zone.  
  * For example, if I want to drag and drop a card into Zone 2, it has to be placed into Zone 1 first, and then dragged and dropped from Zone 1 into Zone 2,  
  * Likewise, to get into Zone 3, a card has to be dragged and dropped from Zone 2, and so on…. It cannot be dragged and dropped directly from Zone 1 or the holding zone  
* Likewise, a card can be moved back into the direct preceding zone, but only the directly preceding zone.If the Zone is Zone 1 the directly preceding Zone is “holding zone”  
* A card, can however, be freely moved across lanes within the same zone.

* When moving a card between zones, a card can also change lanes  
* When the user drops a card into a zone, a visual activity indicator should appear to indicate that the card is being “processed”.  
  * For now, this is a placeholder indicator which will eventually be replaced by some real back-end processing…it should “spin” for 2000 milliseconds.  
* There should be a placeholder API which should be used, for now, to return status information and some informative text. It will later be replaced by more sophisticated logic.  
* When card is dropped into a new zone, the app should call an API and pass these details:   
  * The card name,   
  * the zone name,   
  * The lane name. 

* The API should return some text that provides a human readable description of what just happened, i.e. “Card B” was just moved into “Lane 2” of “Zone 3”.  
  * However, to mock some proper conditional action for each zone (since each zone will be responsible for a different task)., the API should return some different wording for each zone e.g for Zone 4\. something like “Someone just moved a card. It was Card C and they dropped it into Zone 4, and more specifically Lane 3”, and something different again for Zone 1, 3 and 5\.  
* There should be some non-functional visual candy that occurs when someone drops a card into a new zone, such as the zone glowing briefly.


The file “instructionsv1.md” in the current directory was used as a basis to build the app in the current directory.  
 I am sharing it with you so that you understand what has been done already. However, do not follow the instructions in that document.

I would like you to make some changes to the app layout that was specified originally.

. Here are the changes:

1. Reduce the number of “voices” from 5 to 3\.

2. Likewise, reduce the number of lanes from 5 to 3\.

3. On load, not all “Zones” should be visible — only the “holding area” and Zone 1 should be visible when the user opens the app.  
   1. Instead, the Zones should become progressively visible as the user completes tasks in each zone.

4. A zone is marked as “complete” when a user drags all possible voices into a zone.

5. When a user clicks a card in the “holding zone”, the APi should return an audio file to play in the front end, corresponding to the selected voice. There are the audio files to use:  
   1. Voice 1: ./voices/everyday\_cheerful\_middle-aged\_2.wav  
   2. Voice 2: ./voices/everyday\_irritated\_female\_5.wav  
   3. Voice 3 ./voices/everyday\_irritated\_female\_5.wav

6. When a user drags an audio file into zone 1 the API should do some processing on the audio and adjust the pitch.  
   1.  After any of the voices is dragged into lane 1 of Zone 1, the backend should lower the pitch of the audio by 20% of the original and return the pitched down version for the frontend to play automatically.  
   2.  After any of the voices is dragged into lane 2 of Zone 1, the backend should raise the pitch of the audio by 20% of the original and return the pitched op version for the frontend to play automatically.  
   3.  After any of the voices is dragged into lane 3 of Zone 1, the backend should modulate the pitch up and down in a tremolo fashion with 250 milliseconds for each modulation phase.  
   4. The backend should save these modified versions in a temporary location because they will be processed again in subsequent zones.  
   5. Feel free to install any extra library you think is necessary for this task. This app is running on Ubuntu FYI.

7. For the time being, the same pitch should happen in the subsequent zones as well. However the processing should be applied to the artifacts that were generated from processing in the previous zone (rather that the starting state of the audio file)

8. You should also change the vertical spacing between the zones.  
   Specifically, there also be more space underneath each zone to show supplementary information. Let’s call this space the “Details Section.”  
   1. The height of the space between zones should be the same as the height of a zone.  
   2. At the top of the “Details Section” the user should see a progress bar that spans the entire width of the details section. However, the progress bar should start off “empty.”  
   3. When a user drags one card into the zone, the first third of the progress bar should “fill up.” When they drag the second card, the second third should “fill up,” and so on, until all 3 cards are in the zone, and then the progress bar should be full.

9. In the “Details section”, underneath the progress bar, some metadata should appear.   
   1. This metadata should consist of some metrics and a spectrogram that the API will return. There should be a “group” of metadata for each of the 3 voices, and it should show up in each of the 3 “lanes.”  
   2. You should update the API to return some placeholder data (which we will update later) instead of the current textual description describing the user’s last action.  
   3. The placeholder data is as follows:  
      1. Charisma: 50%  
      2. Confidence: 30%  
      3. Pitch: 50%  
      4. Energy: 35%  
      5. SPECTROGRAM: You can find a placeholder image to display here: “./placeholder\_spectrogram.png”  
      6. This data displays for each of the three voices in its respective “lane” once it has been dragged into the target zone. Feel free to slightly vary the percentage data for each of the 3 voices.  
      7. For now the API needs to return placeholder variants for each of the combinations of voice and zone. 

10. The activity indicator should remain to indicate some analysis is happening, and the placeholder data should only appear once the activity indicator has stopped spinning.


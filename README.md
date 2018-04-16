WAD4S
====

WebAudio Designer for Scratch


## Description

This is an adapter application to control [WebAudioDesigner](https://github.com/g200kg/WebAudioDesigner) from [Scratch1.4](https://scratch.mit.edu/scratch_1.4/) and [Scratch2 Offline Editor](https://scratch.mit.edu/scratch2download/). 


## Requirement

* Install [Scratch1.4](https://scratch.mit.edu/scratch_1.4/) or [Scratch2 Offline Editor](https://scratch.mit.edu/scratch2download/)


## Usage

### Scratch1.4

NOT IMPLEMENTED YET

Open `scratch1/osc.sb` on Scratch1.4. 

Open`WAD4S` on OS. 

Select menu `Scratch -> Remote Sensor Connect` on the WAD4S. 
(If you haven't started Scratch1.4 with 'Remote sensor connections enabled' before connecting, error alert will rise at that time.)

Click start-flag on the Scratch, then start to play sound in the WAD4S. The value of `gai1.gain` and `osc1.detune` are changed corresponding with position of the scratch-cat. 

### Scratch2

Open`WAD4S` on OS. 

Open `scratch2/project/osc.sb2` on Scratch2. 

Click start-flag on the Scratch, then start to play sound in the WAD4S. The value of `gai1.gain` and `osc1.detune` are changed corresponding with position of the scratch-cat. 


## Licence

Licensed under MIT except Impulse Response files (included in samples/ir folder).
Inpulse Response files are Licensed under [Voxengo's license](src/AudioWindow/samples/ir/IMreverbs1/license.txt).


## Author

[yokobond](https://github.com/yokobond)

'WebAudio Designer' was written by [g200kg](https://github.com/g200kg)

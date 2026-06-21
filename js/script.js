/**************************************************
P1
Étienne Racine

Built template-p5-project.
This program is a game about dodging bullets using teleportation and screen wrapping to achieve the highest score.
**************************************************/

//#region Classes

/**
 * 2-dimensional vector.
 * Highly inspired by UnityEngine's Vector2.
 */
class Vector2D
{
    /**
     * Creates a 2D vector. 
     * @param {number} x The x coordinate of the vector.
     * @param {number} y The y coordinate of the vector.
     */
    constructor(x,y)
    {
        this.x = x;
        this.y = y;
    }

    /**
     * Returns a new zero vector (0,0).
     */
    static Zero()
    {
        return new Vector2D(0,0);
    }

    /**
     * Returns a new normalized vector with random components.
     */
    static Random()
    {
       return new Vector2D(random(-1,1), random(-1,1)).Normalized();
    }

    /**
     * Returns the magnitude of the vector.
     */
    Magnitude()
    {
        return Math.hypot(this.x, this.y);
    }

    /** 
     * Returns the vector with a magnitude of 1 (if possible). Otherwise returns the zero vector.
     */
    Normalized()
    {
        //Calculates the magnitude of the non-normalized vector.
        let magnitude = this.Magnitude();
        
        //If the magnitude is 0, then the vector was the zero vector (we also don't want to divide by 0).
        if(magnitude !== 0)
        {
            return new Vector2D((this.x / magnitude), (this.y / magnitude));
        }
        else { return Vector2D.Zero(); }
    }

    /**
     * Multiplies each component of the vector.
     * @param {number} scalingFactor The amount to scale the vector.
     */
    Scale(scalingFactor)
    {
        return new Vector2D(this.x * scalingFactor, this.y * scalingFactor);
    }
}


/**
 * Point moving in a single direction.
 */
class bullet
{
    /**
     * 
     * @param {Vector2D} position Starting position of the bullet. 
     * @param {Vector2D} velocity Direction of the bullet.
     * @param {boolean} type of the bullet (false: normal, true: debris).
     */
    constructor(position, velocity, type)
    {
        this.bPos = position; //Tracks the position of the bullet.
        this.bVel = velocity; //Tracks the velocity of the bullet.
        this.type = type; //Represents the type of bullet (false: normal, true: debris).
        this.bTime = 0; //Tracks how long the bullet has existed.
        this.hit = false; //Tracks if the bullet has hit the player.
    }

    //Holds all the existing bullets.
    static bCurrent = [];


    //Updates every bullet that currently exists. 
    static bUpdateCurrent()
    {
        //For every bullet in 'bCurrent', call
        for(let i = 0; i < this.bCurrent.length; i++)
        {
            //Since we call the method for the specific bullet, we won't have to refer it from the array every time.
            this.bCurrent[i].bUpdate();
            
            //If the bullet is out of the screen, has existed for longer than its lifetime or has hit the player,
            //remove it from the array and stop considering it.
            if(outsideBoundsCheck(this.bCurrent[i].bPos) || this.bCurrent[i].bTime >= 240 || this.bCurrent[i].hit) 
            {
                //Take the bullet out of the array.
                delete this.bCurrent.splice(i, 1);  //I'm not sure if the 'delete' actually frees up any memory.
            }
        }
    }

    //Advances the bullets and check if they collide with the player.
    bUpdate() 
    {
        //Normal bulets live for 5 seconds and debris live for half of that.
        //If the bullet is normal, add one to to time, if it's a debris, add 2.
        this.bTime += (1 + (int(this.type)));

        //Advances the bullet by its velocity.
        this.bPos.x += this.bVel.x;
        this.bPos.y += this.bVel.y;

        //Calculates the distance between the player and the bullet.
        let bDist = dist(this.bPos.x, this.bPos.y, Player.pPos.x, Player.pPos.y);

        //If the player is close enough to a bullet, consider it as a hit.
        //Debris bullets are 33% bigger than normal ones.
        if(bDist < 10 & this.type) { this.bHit(); }
        else if (bDist < 7.5) { this.bHit(); }
    }

    //Resets some player values, tags the bullet to be removed and plays a hitsound.
    bHit()
    {
        //Set the player's hit time at the maximum.
        Player.pHitTime = 72;
        //Disable the player's laser effects if it is warming or firing.
        if(Player.pLaserFire || Player.pWarming > 0) 
        {
            Player.pWarming = 0; 
            warmupSound.stop();
            laserSound.stop();
        }

        //Reset the player's score and charge.
        Player.pCScore = 0;
        Player.pCharge = 0;

        //Tag this bullet to be removed.
        this.hit = true;

        //Play a new hitSound.
        hitSound[randNewInt(hitSound.length, lastHitSound)].play();
    }
}

//#endregion

//#region Entities

//Representation of the player 'character'.
let Player =
{
    //Image representing the player (assigned in preload()). 
    pSprite: undefined,

    //Represents the XY position of the player object.
    pPos: new Vector2D(0,0),

    //Tracks the last 4 positions of the player
    pPrevPos : [],

    //Represents the XY velocity of the player object.
    pVel: new Vector2D(0,0),
    //We have a separate vector because we want to manipulate the velocity input before applying it.
    pVelAdd: new Vector2D(0,0),

    //Tracks the cooldown remaining for the teleport.
    pCooldown: 180,

    //Tracks the time since the player has been hit. Counts backwards from 72 to 0.
    pHitTime: 0,

    //Tracks the current score of the player.
    pCharge: 0,

    //Tracks the highest score the player reached.
    pHScore: 0,

    //Tracks the current score of the player
    pCScore: 0,

    //Tracks the size of a circle that shrinks before firing the laser.
    pWarming: 0,

    //Tracks if the player's laser is firing.
    pLaserFire: false,

    /**
    * Handles everything related to the player's movement.
    */
    //Is called once per draw().
    pBehaviour()
    {
        //PHYSICS & ENVIRONMENT

        //Ups the time where the player hasn't been hit counting backwards.
        if (this.pHitTime > 0) { this.pHitTime--; }

        //Log the position the player had last frame since it didn't get a new one yet.
        //For some reason, giving the vector directly seems to break things, so another one is constructed with same values.
        this.pPrevPos.unshift(new Vector2D(this.pPos.x, this.pPos.y)); 
        delete this.pPrevPos.pop();   //Clear the now 5th entry of the array as it isn't needed.

        //If the player exits any of the window edges, loops them back on the opposite side.
        if(this.pPos.x < 0) { this.pPos.x = windowWidth; }
        if(this.pPos.x > windowWidth) { this.pPos.x = 0; }
        if(this.pPos.y < 0) { this.pPos.y = windowHeight; }
        if(this.pPos.y > windowHeight) { this.pPos.y = 0; }

        //Mimicks friction - Slows the player down by 7.5% if their velocity isn't 0.
        if(this.pVel.x !== 0) { this.pVel.x = moveTowards(this.pVel.x, 0, 0.075 * this.pVel.x); }
        if(this.pVel.y !== 0) { this.pVel.y = moveTowards(this.pVel.y, 0, 0.075 * this.pVel.y); }

        //Move the player by their current velocity. 
        //With the built-in friction, the max speed is 20 (asymptotic).
        this.pPos.x += this.pVel.x;
        this.pPos.y += this.pVel.y;

        //Ups the cooldown timer of the player's teleport by 1 if it isn't 180.
        if(this.pCooldown < 180) 
        { 
            this.pCooldown++;

            //If the cooldown is now over play the sound for it.
            if(this.pCooldown >= 180) { readySound.play(); } 
        }

        //If the player is firing the laser, drain charge.
        if(this.pLaserFire || this.pWarming > 0) { this.pCharge -= 0.2; }
        //Ups the player's charge if it isn't maxed.
        else if (this.pCharge < 100)
        { 
            this.pCharge += 0.1; 

            //If the laser is now charged, round the number and play a sound to let the user know.
            if(this.pCharge >= 100) 
            {
                this.pCharge = 100; //Round the number to 100.
                chargedSound.play(); //Play the sound.
            }
        }

        //If the player's charge under 0, reset it and disable the laser if active.
        if(this.pCharge < 0) 
        {
            this.pLaserFire = false; //Disable the laser.
            this.pCharge = 0; //Set the charge back at 0.
            laserSound.stop();
        }

        //If the player is firing the laser ups the score by 2. Otherwise, ups the current score by 1.
        this.pCScore += (1 + this.pLaserFire);
        //The highscore follows the current score if it is the highest recieved.
        if(this.pCScore > this.pHScore) { this.pHScore = this.pCScore; }

        //INPUTS

        //Teleports the player to the mouse's position and plays a sound if spacebar is pressed or if the mouse is clicked and if the cooldown is over.
        if((keyIsDown(32) || mouseIsPressed) && this.pCooldown >= 180)
        {
            //Reset the cooldown.
            this.pCooldown = 0; 

            //Teleport the player to the mouse's position.
            this.pPos.x = mouseX;
            this.pPos.y = mouseY;

            //Resets the player's velocity.
            this.pVel.x = 0;
            this.pVel.y = 0;

            //Play the sound for teleporting.
            teleportSound.play();
        }


        //If W, A, S or D are pressed, add to the player's velocity in the appropriate direction.
        if(keyIsDown(87)) { this.pVelAdd.y -= 0.2; }   //If 'W' is pressed, add velocity upwards.
        if(keyIsDown(65)) { this.pVelAdd.x -= 0.2; }   //If 'A' is pressed add velocity to the left.
        if(keyIsDown(83)) { this.pVelAdd.y += 0.2; }   //If 'S' is pressed add velocity downwards.
        if(keyIsDown(68)) { this.pVelAdd.x += 0.2; }   //If 'D' is pressed add to the right.

        //If Q is pressed, charge is over 100 and the player isn't using the laser, start warming it.
        if(keyIsDown(81) && this.pCharge >= 100 && !this.pLaserFire && this.pWarming <= 0) 
        {
            this.pWarming = 480; //Gives 2/3 of a second of warming.
            warmupSound.play(); //Starts the sound effect.
        }


        //Normalizes the addXY vector and applies each component to the player velocity.
        //Store the normalized vector instead of doing the Normalized calculation twice.
        this.pVelAdd = this.pVelAdd.Normalized();

        //Give the components of the normalized vector sepatately
        this.pVel.x += this.pVelAdd.x;
        this.pVel.y += this.pVelAdd.y;
    
        //Resets the velAdd vector for the next frame.
        this.pVelAdd = Vector2D.Zero();
    },
}


//Representation of the enemy 'character'
let Enemy = 
{
    //Image representing the enemy (assigned in preload()). 
    eSprite : undefined,

    //Represents the XY position of the enemy object.
    ePos: new Vector2D(0,0),

    //Tracks the velocity of the enemy.
    eVel: new Vector2D(0,0),

    //Represents the speed of the enemy.
    eSpeed: 4,


    //Tracks which attack state the enemy is in.
    /*
    0: Slow enemy, fast bullets.
    1: Fast enemy, slow bullets.
    2: Average for both.
    */
    ePhase: -1, //-1 is the starting phase where there is no bullets

    //Tracks the last phase the enemy was in (to prevent getting the same thing twice)
    eLastPhase : undefined,

    //Tracks the time unitl the next phase change.
    ePhaseTimer: 360, //Starts at three quarters time.


    //Counts the number of bullets that have been launched in draw().
    eBCount : 0,

    //Represents the number of bullets lauched per draw().
    eBAmount : 0,

    //Tracks the direction of the next bullet.
    eBDir : Vector2D.Zero(),

    //Represents the speed of the enemy.
    eBSpeed: 0,

    //Tracks if the bullets are aimed at the player.
    eAim : false,

    //Represents the chance for the enemy to aim at the player.
    eAimChance : 0.4,

    //Update the enemy's position, launch bullets and possibly change phase.
    eBehaviour()
    {
        //Ups the phase timer if it is smaller than 240 (480 is 10 seconds since we're at 48 FPS).
        if(this.ePhaseTimer < 480) { this.ePhaseTimer++; }

        //Otherwise, (if the timer is over 480) change the phase.
        else
        {
            //Reset the phase timer.
            this.ePhaseTimer = 0;

            //Record the current phase in to make sure not to repeat it.
            this.eLastPhase = this.ePhase;

            //Get a new phase.
            this.ePhase = randNewInt(3, this.eLastPhase);

            //Switch enemy properties depending on phase.
            switch(this.ePhase)
            {
                //Slow enemy but very fast bullets.
                case 1:
                    this.eSpeed = 3;
                    this.eBSpeed = 10;
                    this.eBAmount = 2;
                break;

                //Fast enemy, but very slow bullets.
                case 2:
                    this.eSpeed = 10;
                    this.eBSpeed = 3;
                    this.eBAmount = 2;
                break;

                //Average for both.
                default:
                    this.eSpeed = 6;
                    this.eBSpeed = 6;
                    this.eBAmount = 2;
            }

            //40% chance to aim the bullets at the player (60% for enemy variant).
            if((random(1) < this.eAimChance))
            { 
                this.eAim = true;
                this.eBSpeed *= 2;
            }
            else { this.eAim = false; }

            //Give the enemy a random velocity.
            this.eVel = Vector2D.Random().Scale(this.eSpeed);
        }

        //Move the enemy by its velocity.
        this.ePos.x += this.eVel.x;
        this.ePos.y += this.eVel.y;
    
        //If the enemy is out of borders, reverse its velocity (make it 'bounce' back).
        if(this.ePos.x < 0 ) { this.ePos.x = 0; this.eVel.x = -this.eVel.x; }
        if(this.ePos.x > windowWidth) { this.ePos.x = windowWidth; this.eVel.x = -this.eVel.x;  }
        if(this.ePos.y < 0) { this.ePos.y = 0; this.eVel.y = -this.eVel.y;}
        if(this.ePos.y > windowHeight) { this.ePos.y = windowHeight; this.eVel.y = -this.eVel.y; }

        //Launches a number of bullets specified by the phase.
        while(this.eBCount < this.eBAmount)
        {
            //If aiming at the player, set the direction and add some deviation.
            if(this.eAim)
            {
                //Set the direction directly towards the player.
                this.eBDir.x = (Player.pPos.x - Enemy.ePos.x);
                this.eBDir.y = (Player.pPos.y - Enemy.ePos.y);

                //Set the magnitude to 1 to make spread consistent.
                this.eBDir = this.eBDir.Normalized();

                //Add some random deviation to the direction.
                this.eBDir.x += random(-0.225, 0.225);
                this.eBDir.y += random(-0.225, 0.225);

                //Normalze vector for a consistent speed.
                this.eBDir - this.eBDir.Normalized();

                //Increase by 2 as to launch half as many bullets if aiming at the player.
                this.eBCount += 2;   
            }

            //If not aiming at the player, select a random direction.
            else
            {
                //Set a random direction.
                this.eBDir = Vector2D.Random();

                //Ups the bullet count for this draw().
                this.eBCount++;
            }  

            //Add a new bullet in the current array.
            //The bullet starts from the enemy and has a velocity in the direction specified scaled by the bullet speed.
            bullet.bCurrent.unshift(new bullet(new Vector2D(this.ePos.x, this.ePos.y),this.eBDir.Scale(this.eBSpeed), false));
        }

        //Reset the bullet count for next draw().
        this.eBCount = 0;

        //If the player is firing the laser, add an extra debris bullet.
        if(Player.pLaserFire)
        {
            //Set a random velocity with a magnitude of 5.
            this.eBDir = Vector2D.Random().Scale(8);

            //Make the debris' velocity relative to the enemy.
            this.eBDir.x += this.eVel.x;
            this.eBDir.y += this.eVel.y;

            //Add a new debris bullet to the current array.
            //The bullet starts from the enemy and has a velocity specified above.
            bullet.bCurrent.unshift(new bullet(new Vector2D(this.ePos.x, this.ePos.y), new Vector2D(this.eBDir.x, this.eBDir.y), true));
        }
    }
}


//preload()
//Loads the enemy's sprite.
//Is called once before all other functions.
function preload()
{
    //Load the enemy sprite.
    //12.5% chance to load an enemy variant sprite.
    if(random(1) > 0.875) 
    { 
        Enemy.eSprite = loadImage('assets/images/watcher2.png');
        Enemy.eAimChance = 0.6;    //Enemy variant is more likely to aim at the player.
    }
    else{ Enemy.eSprite = loadImage('assets/images/watcher1.png');}

    //Load the usual player sprite.
    Player.pSprite = loadImage('assets/images/player.png');

    //Load sounds for if the player is hit.
    hitSound.unshift(loadSound('assets/sounds/sndhit1.wav'));
    hitSound.unshift(loadSound('assets/sounds/sndhit2.wav'));
    hitSound.unshift(loadSound('assets/sounds/sndhit3.wav'));

    //Load the sound for teleporting
    teleportSound = loadSound('assets/sounds/sndteleport.wav');
    //Load the sound for when the teleport cooldown is over.
    readySound = loadSound('assets/sounds/sndready.wav');
    //Load the sound for if the laser is fired.
    laserSound = loadSound('assets/sounds/sndlaser.wav');
    //Load the sound for if the laser is charged.
    chargedSound = loadSound('assets/sounds/sndcharged.wav')
    //Load the sound for if the laser is warming.
    warmupSound = loadSound('assets/sounds/sndwarmup.wav');

    //Load each music track.
    music[0] = loadSound('assets/sounds/CHRISRGMFB - Grid Run.mp3');
    music[1] = loadSound('assets/sounds/EVA - The End.mp3');
    music[2] = loadSound('assets/sounds/HOME - Before the Night.mp3');
    music[3] = loadSound('assets/sounds/MONIN - The House.mp3');
    music[4] = loadSound('assets/sounds/Moon Blade - Neon Rain.mp3');
    music[5] = loadSound('assets/sounds/Neon.Deflector - Artifact.mp3');

    //Load each track's name.
    musicNames[0] = 'CHRISRGMFB - Grid Run';
    musicNames[1] = 'EVA - The End';
    musicNames[2] = 'HOME - Before the Night';
    musicNames[3] = 'MONIN - The House';
    musicNames[4] = 'Moon Blade - Neon Rain';
    musicNames[5] = 'Neon.Deflector - Artifact';
}

//#endregion

// setup()
//Is called once on startup
//Prepares the canvas/background and modifies general settings
function setup() 
{
    //Create the canvas and set the background color
    createCanvas(windowWidth, windowHeight);
    background(0,0,25);


    //#region Settings

    frameRate(48);  //Lowers the framerate to reduce CPU usage (still looks good at 48fps).
    noCursor(); //Hides the cursor as there is a custom one provided.
    colorMode(HSB); //HSB is useful as the brightness component only ranges from 0-100

    //Changes the fill to bright green and disables stroke.
    fill(120,100,100);
    noStroke();

    //Sets shapes and images to be drawn from the center.
    ellipseMode(CENTER);
    rectMode(CENTER);
    imageMode(CENTER);

    //Set the text style for the game state.
    textSize(15);

    //Lower the volume of each track and put them on loop.
    for(let i = 0; i < music.length; i++) 
    {
        music[i].setVolume(0.1); //Sets the volume to a tenth of its value.
        music[i].onended(startNewTrack); //Call 'startNewTrack' if a track ends.
    }

    //Halves the volume of each hitSound
    for(let i = 0; i < hitSound.length; i++) { hitSound[i].setVolume(0.5); }

    //Get the screen's dimensions as initial values.
    maxScreenSize.x = windowWidth;
    maxScreenSize.y = windowHeight;

    //#endregion

    //#region Positioning Objects

    //Instead of doing the same calculation 5 times, we can save the position of the center in a variable.
    let centerPos = new Vector2D(windowWidth/2, windowHeight/2);

    //Places the the enemy at the top of the screen and the player at the bottom.
    Player.pPos = new Vector2D(centerPos.x, centerPos.y * 1.5);
    Enemy.ePos = new Vector2D(centerPos.x, centerPos.y * 0.25);

    //Set the 4 last positions as the player's postition on startup.
    for(let i = 0; i < 4; i++) { Player.pPrevPos[i] = Player.pPos; }
    //#endregion
}

//#region Variables

//Tracks the 2 different states of the game.
let playing = false;

//Tracks the largest screen size that was used (related to game difficulty).
let maxScreenSize = Vector2D.Zero();

//Tracks if the user has gone through the title state once and started the music.
let musicStarted = false; 

//Sound used if the player gets hit.
let hitSound = [];
let lastHitSound = undefined;   //Keeps the last hitsound's index.

//Sound used when teleporting.
let teleportSound = undefined;
//Sound used when the teleport cooldown is over.
let readySound = undefined;
//Sound used when firing the laser.
let laserSound = undefined;
//Sound used when the laser is charged.
let chargedSound = undefined;
//Sound used when warming the laser.
let warmupSound = undefined;

//Music used in the background.
let music = new Array(6);
let lastMusic = undefined;   //Keeps the last track's index.
let musicNames = new Array(6); //Keeps each track's name.
let currentTrack = 'Nothing' //Keeps the name of the current track.

//Game tips that are displayed on pause.
let tips = 
[
    `The laser, as well as doubling recieved\nscore, also creates additional debris.\nMake sure to use it when it's safe enough.`,
    `Since teleporting has a cooldown and\nobscures vision, it's best to loop using the\nscreen's edges to get around and to leave\nteleporting as a backup.`,
    `The inner circle around you shows the\nteleport's cooldown timer while the outer\nshows the laser's charge.`,
    `There are indcators on each edge of the\nscreen showing exactly where you will\nend up by looping.`,
    `If there is a cross around you, it\nmeans that you're being targeted.`
]
//Tracks which tip should be displayed. Increments everytime the game is unpaused.
let tipIndex = 0;

//#endregion

// draw()
//Is called 48 times per second.
//Computes physics, registers inputs and renders each frame.
function draw() 
{
    //Don't update if the window is not in focus.
    if(focused)
    {
        if(playing)
        {
            //Update the player's position and react to inputs.
            Player.pBehaviour();
            //Update the enemy's position, launch bullets and possibly change phase.
            Enemy.eBehaviour();
            //Update all bullets that currently exist.
            bullet.bUpdateCurrent();

            //If the the laser is warming, draw a circle aroung the player.
            if(Player.pWarming > 0)
            {
                Player.pWarming -= 15; //Reduce the warming by 15.

                //If the warming reaches 0 or lower, start firing the laser.
                if(Player.pWarming <= 0) 
                { 
                    Player.pLaserFire = true; 
                    laserSound.loop();
                }
            }

            //If ESCAPE is pressed, switch to the paused state.
            if(keyIsDown(27)) { playing = false; }
        }

        //#region Rendering

        //Redraws the background with a color dependent of the player's cooldown and hit timers.
        //Background is red after the player is hit.
        //Background is dark after the player teleports.
        background(0, Player.pHitTime, Player.pCooldown / 6); 

        //Display the highest score, current score and charge.
        text(`HIGHSCORE: ${
            Player.pHScore.toLocaleString(undefined, {minimumIntegerDigits: 6, useGrouping: false})
        }\nSCORE: ${
            Player.pCScore.toLocaleString(undefined, {minimumIntegerDigits: 6, useGrouping: false})
        }\n\nCHARGE: ${Player.pCharge.toFixed(1)}%`, 4, 16);

        //Displays the name of the track playing at the bottom left of the screen.
        text(`Currently Playing:\n${currentTrack}`, 4, windowHeight - 25);


        //Create a trail by drawing an cricle for the last 5 positions the player had. 
        for(let i = 0; i < Player.pPrevPos.length; i++)
        {
            //Creates an circle at the position specified in the array. Each smaller than the last (minimum 2).
            circle(Player.pPrevPos[i].x, Player.pPrevPos[i].y, 10 - (2 * i));
        }


        //If the enemy is aiming at the player, draw a cross around it.
        if(Enemy.eAim)
        {
            push(); //We don't want to keep the following drawing settings.
            fill(0, 100, 50, 0.75); //Give  transparent red color to the cross.

            //Draw a cross around the player.
            rect(Player.pPos.x - 25, Player.pPos.y, 12, 3);
            rect(Player.pPos.x + 25, Player.pPos.y, 12, 3);
            rect(Player.pPos.x, Player.pPos.y - 25, 3, 12);
            rect(Player.pPos.x, Player.pPos.y + 25, 3, 12);

            pop(); //Revert to the previous drawing settings.
        }

        //Draw two hollowed circles around the player showing the progress of the teleport cooldown and of the laser charge.
        push(); //We don't want to keep these drawing settings.
        
        //Remove the fill, set the stroke weight and make their ends square for both cicles.
        noFill();
        strokeWeight(3);
        strokeCap(SQUARE);

        //Draw an inner transparent orange circle that's dependent on the teleport cooldown.
        stroke(30, 100, 100, 0.75);
        arc(Player.pPos.x, Player.pPos.y, 30, 30, -HALF_PI, (TWO_PI * Player.pCooldown / 180) - HALF_PI);

        //Draw an outer transparent green circle that's dependent on the laser's charge.
        stroke(120, 100, 100, 0.75);
        arc(Player.pPos.x, Player.pPos.y, 35, 35, -HALF_PI, (TWO_PI * Player.pCharge / 100) - HALF_PI);
        
        pop(); //Revert to the previous drawing settings.
        
        //Draw rectangles at each edge of the screen showing the player's projected position.
        push(); //We don't want to keep these drawing settings.
        fill(120, 100, 100, 0.4); //Give the rectangles tansparent green color.

        //Draw the rectangles at the player's position projected onto the edges of the screen.
        rect(Player.pPos.x, 2, 10, 2);
        rect(Player.pPos.x, windowHeight - 2, 10, 2);
        rect(2, Player.pPos.y, 2, 10);
        rect(windowWidth - 2, Player.pPos.y, 2, 10);

        pop(); //Revert to the previous drawing settings.


        //Draws the player object at its specified position.
        tint(0, Player.pHitTime, 100);  //The tint of the sprite is red after the player is hit.
        image(Player.pSprite, Player.pPos.x, Player.pPos.y);

        //If the the laser is warming, draw a circle aroung the player.
        if(Player.pWarming > 0)
        {
            push(); //We don't want to keep these drawing settings.

            //Give the circle a green whose transparency is dependent on the laser's warming.
            fill(120, 100, 50, 0.5 * (1 - (Player.pWarming / 480)))
            circle(Player.pPos.x, Player.pPos.y, Player.pWarming);
    
            pop(); //Revert to the previous drawing settings.
        }  

        //If the player is firing thier laser, calculate and draw a green line from it to the enemy.
        if(Player.pLaserFire) 
        {
            push(); //We don't want to keep these drawing settings.

            strokeWeight(7); //Increase the thickness of the line.
            stroke(120, 100, 75, 0.25); //Give the line a dark green color.
            //Draw a line from the player's center that goes to the enemy (outer).
            line(Player.pPos.x, Player.pPos.y, Enemy.ePos.x, Enemy.ePos.y);

            strokeWeight(3); //Decrease the thickness of the line.
            stroke(120, 100, 100, 0.25); //Give the line a light green color.
            //Draw a line from the player's center that goes to the enemy (inner).
            line(Player.pPos.x, Player.pPos.y, Enemy.ePos.x, Enemy.ePos.y);

            pop();  //Revert to the previous drawing settings.
        }

        //Draw the enemy sprite with a tint dependent on its 'phaseTimer'.
        tint(Enemy.ePhaseTimer * 0.208);    //0.208 mean that the tint will reach close to 100% brighness at phaseTimer's max value.
        image(Enemy.eSprite, Enemy.ePos.x, Enemy.ePos.y);


        //We don't want to keep the bullet drawing settings.
        push(); 

        //Draw evey bullet that currently exists.
        for(let i = 0; i < bullet.bCurrent.length; i++)
        {
            //If the bullet is a debris, draw a 'flaming' circle.
            if(bullet.bCurrent[i].type)
            {
                //Debris bullets constantly change color between red and yellow. Their transparency depends on the time they've existed.
                fill(int(random(10, 50)), 100, 100, 1 - (bullet.bCurrent[i].bTime / 300));
                //Draw the debris bullet as a 'flaming' circle.
                circle(bullet.bCurrent[i].bPos.x, bullet.bCurrent[i].bPos.y, 15);
            }
            //If the bullet is normal, draw a small black circle that flashes white if the player is hit.
            else
            {
                //Normal bullets are black and flash white if the palyer is hit.
                fill(0, 0, Player.pHitTime, 1 - (bullet.bCurrent[i].bTime / 300));
                //Draw the bullet as a small black circle.
                circle(bullet.bCurrent[i].bPos.x, bullet.bCurrent[i].bPos.y, 10);
            }
        }

        pop(); //Revert to previous drawing settings.


        //If not in the game state, then draw a transparent background over the frame with text.
        if(!playing)
        {
            //Draw a semi-transparent black background.
            background(0, 0.4);

            push(); //We don't want to keep these settings.
            
            //Set the alinment for what will be written to the left of the screen.
            textAlign(LEFT, TOP);
            
            //Write instructions (top-left) and controls (middle left) section header is large letters.
            textSize(35);
            text(`Instructions:`, 15, windowHeight * 0.1);
            text(`Controls:`, 15, windowHeight * 0.5); 

            //Write the instructions (top-left) and controls (bottom-left) section contents in smaller letters.
            textSize(25);
            text(`- Don't get hit!\n- Score and charge accumulate over time.\n- When charge reaches 100%, a laser can be fired.\n- The laser doubles the score received while it's acitve.\n- The screen's edges loop you back to the opposite side.\n- Difficulty level can be adjusted using window size and zoom.`, 30, windowHeight * 0.1 + 50);
            text(`- W, A, S and D to move.\n- SPACE or Mouse Click to teleport.\n- Q to fire the laser.\n- ESCAPE to pause.`, 30, windowHeight * 0.5 + 50);
            text(`Consider lowering your volume.\nPress any key to start.`, 25, windowHeight * 0.5 + 200);

            //Set the alignment for what will be written on the right side of the screen.
            textAlign(CENTER, TOP);            

            //Write the maximum window size (top-right) used and the tips header (bottom-right) in large letters.
            textSize(30);
            text(`Max. Window Size Used:`, windowWidth * 0.75, windowHeight * 0.1 + 50);
            text(`${maxScreenSize.x}, ${maxScreenSize.y}`, windowWidth * 0.75, windowHeight * 0.1 + 85);
            text(`Tip:`, windowWidth * 0.75, windowHeight * 0.6);

            //Write a tip from the tips array in smaller letters at the bottom right of the screen.
            textSize(25);
            text(tips[tipIndex], windowWidth * 0.75, windowHeight * 0.6 + 40);

            //Write a small specification under the maximum window size used.
            textSize(17);
            text(`(Can be refreshed by reloading the page)`, windowWidth * 0.75, windowHeight * 0.1 + 125);
            
            //Write the highscore in large bold letters.
            textStyle(BOLD);
            textSize(40);
            text(`HIGHSCORE: ${Player.pHScore.toLocaleString(undefined, {minimumIntegerDigits: 6, useGrouping: false})}`, windowWidth * 0.75, windowHeight * 0.1 + 5);

            pop(); //Revert to the previous drawing settings.


            //Start the game if a key that isn't ESCAPE is pressed.
            if(keyIsPressed && keyCode != 27) 
            { 
                //Start the music if it hasn't been started before.
                if(!musicStarted) 
                {
                    startNewTrack(); //Starts a new track.
                    musicStarted = true; //Prevents music from being started again.
                }

                //Show the next tip when the game pauses again.
                tipIndex++;
                //Make the index loop back to the start if the user has gone through every tip.
                if(tipIndex >= tips.length) { tipIndex = 0; }

                playing = true; //Switch to the game state.
            }
        }

        //Draws a custom '+' cursor at the mouse position.
        rect(mouseX,mouseY, 17, 1);
        rect(mouseX,mouseY, 1, 17);

        //#endregion
    }

    //If the window is not is focus, pause the game and stop the laser sound if it is active.
    else 
    {
        playing = false; //Set the game to the pause state.
        laserSound.stop(); //Stop the laser sound if it is active.
    }
}



/**
 * Returs a random integer number that is different from 'lastValue'.
 * @param {number} limit The upper limit of the generated value (exclusive).
 * @param {number} lastValue 
 */
function randNewInt(limit, lastValue)
{
    //Tracks the generated value.
    let newValue;

    //Give a new random number.
    do
    {
        //Turns the generated number into an integer and saves it.
        newValue = int(random(limit));
    }
    //Repeat as long as the phase number is the same as last time.
    while(newValue === lastValue);

    return newValue;
}



/** Starts a new track and logs the track's name intp 'currTrack'. */
function startNewTrack() 
{
    lastMusic = randNewInt(music.length, lastMusic); //Get a new index that is different from the last.
    music[lastMusic].play(); //Play the track related to the new index.
    currentTrack = musicNames[lastMusic];  //Log the name of the now playing track.
}



/**
 * Checks if the given position is outside the bounds of the screen.
 * @param {Vector2D} position
 */
function outsideBoundsCheck(pos)
{
    //If the position is outside the bounds return true, otherwise return false.
    if( (pos.x < 0 || pos.x > windowWidth) || (pos.y < 0 || pos.y > windowHeight) ) { return true; }
    else { return false; }
}



/**
 * Shifts 'current' towards 'target' at a rate of 'delta' making sure not to go over it.
 * @param {number} current - the current value.
 * @param {number} target - the target value.
 * @param {number} delta - the rate at which 'current' moves to 'delta'.
 */
//Is called twice per draw().
//Highly inspired by UnityEngine's Mathf.moveTowards.
function moveTowards(current, target, delta)
{
    let isBigger;   //Tracks if the input is larger than the target.

    //If the input is larger than the target, than set 'isBigger' appropriately and remove 'delta' from 'current'.
    if(current > target) 
    {   
        isBigger = true; 
        current -= Math.abs(delta); 
    }
    //If the input is smaller than the target, than set 'isBigger' appropriately and add 'delta' to 'current'.
    else if (current < target) 
    { 
        isBigger = false;
        current +=  Math.abs(delta); 
    }

    //Corrects the values of 'current' if it moved past 'target'.
    if
    ( 
        (isBigger && current < target) //If the target was bigger and now isn't, then we've passed the target.
        ||
        (!isBigger && current > target) //If the target was smaller and now isn't, then we've passed the target.
    )
    { 
        current = target; //We wanted to stop at target.
    }

    return current;
}



/**
 * Adjusts the size of what's displayed to match the window.
 * Record the screen's size if it is bigger than before.
 */
//Is automatically called if the window is resized at any point.
function windowResized()
{
  //Resizes the canvas with the values of the window
  resizeCanvas(windowWidth, windowHeight);

  //Record the screen's dimensions individually if they are larger than before.
  if(windowWidth > maxScreenSize.x) { maxScreenSize.x = windowWidth; }
  if(windowHeight > maxScreenSize.y) { maxScreenSize.y = windowHeight; }
}
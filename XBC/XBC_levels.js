function getLevels() {
	var levels = [
		//new level
		{ name: "Easy 1 - basicControls",
			bases:[
			{ownership: 1,x: 0.35,y: 0.25,levelMax: 1,},
			{ownership: 2,x: 0.5,y: 0.75,levelMax: 1,},
			{ownership: 1,x: 0.65,y: 0.25,levelMax: 1,},
			]
		},
		{ name: "Easy 2 - Conquer",
			bases:[
			{ownership: 1,x: 0.25,y: 0.15,levelMax: 1,},
			{ownership: 1,x: 0.5,y: 0.15,levelMax: 1,},
			{ownership: 1,x: 0.75,y: 0.15,levelMax: 1,},
			{ownership: 0,x: 0.25,y: 0.3,levelMax: 1,},
			{ownership: 0,x: 0.5,y: 0.3,levelMax: 1,},
			{ownership: 0,x: 0.75,y: 0.3,levelMax: 1,},
			{ownership: 0,x: 0.5,y: 0.7,levelMax: 1,},
			{ownership: 2,x: 0.33,y: 0.85,levelMax: 1,},
			{ownership: 2,x: 0.66,y: 0.85,levelMax: 1,},
			]
		},
		{ name: "Easy 3 - Upgrade",
			bases:[
			{ownership: 1,x: 0.5,y: 0.25,levelMax: 3,},
			{ownership: 2,x: 0.5,y: 0.75,levelMax: 1,},
			]
		},
		{	name: "Easy 4 - No go zone / Julien",	
			bases:[
					{ownership: 1,y: 0.5,	x: 0.35,levelMax: 1,},
					{ownership: 1,y: 0.5,	x: 0.5,levelMax: 1,},
					{ownership: 1,y: 0.5,	x: 0.65,levelMax: 2,},
					{ownership: 2,y: 0.25,	x: 0.50,levelMax: 2,},
					{ownership: 3,y: 0.75,	x: 0.50,levelMax: 2,},
					{ownership: 0,y: 0.35,	x: 0.40,levelMax: 1,},
					{ownership: 0,y: 0.35,	x: 0.60,levelMax: 1,},
					{ownership: 0,y: 0.60,	x: 0.40,levelMax: 1,},
					{ownership: 0,y: 0.60,	x: 0.60,levelMax: 1,},					
				]	
		},
		{ name: "Easy 5 - Ennemies",
			bases:[
			{ownership: 0,x: 0.2,y: 0.2,levelMax: 1,},
			{ownership: 1,x: 0.5,y: 0.2,levelMax: 2,},
			{ownership: 0,x: 0.8,y: 0.2,levelMax: 1,},
			{ownership: 0,x: 0.5,y: 0.4,levelMax: 1,},
			{ownership: 0,x: 0.5,y: 0.6,levelMax: 1,},
			{ownership: 2,x: 0.2,y: 0.8,levelMax: 1,},
			{ownership: 0,x: 0.5,y: 0.8,levelMax: 2,},
			{ownership: 3,x: 0.8,y: 0.8,levelMax: 1,},
			]
		},
		{	name: "Easy 6 - Wide open",
			bases:[
					{ownership: 1,x: 0.20,y: 0.30,levelMax: 1,},
					{ownership: 1,x: 0.4,y: 0.20,levelMax: 1,},
					{ownership: 2,x: 0.7,y: 0.75,levelMax: 1,},
					{ownership: 0,x: 0.45,y: 0.45,levelMax: 2,},
					{ownership: 0,x: 0.55,y: 0.25,levelMax: 1,},	
					{ownership: 0,x: 0.30,y: 0.55,levelMax: 1,},
					{ownership: 0,x: 0.70,y: 0.45,levelMax: 1,},
					{ownership: 0,x: 0.45,y: 0.70,levelMax: 1,},
				]	
		},
		{	name: "Easy 7 - Satellize",
			bases:[
					{ownership: 1,x: 0.25,y: 0.25,levelMax: 2,},
					{ownership: 1,x: 0.75,y: 0.75,levelMax: 2,},
					{ownership: 2,x: 0.50,y: 0.5,levelMax: 2,},
					{ownership: 0,x: 0.35,y: 0.40,levelMax: 1,},
					{ownership: 0,x: 0.35,y: 0.7,levelMax: 1,},
					{ownership: 0,x: 0.65,y: 0.40,levelMax: 1,},
					{ownership: 0,x: 0.65,y: 0.70,levelMax: 1,},
				]	
		},
		{ name: "Easy 8 - Julien hello world",
			bases:[
				{ownership: 1,x: 0.3,y: 0.2,levelMax: 1,},
				{ownership: 1,x: 0.7,y: 0.2,levelMax: 1,},
				{ownership: 0,x: 0.3,y: 0.4,levelMax: 3,},
				{ownership: 0,x: 0.5,y: 0.4,levelMax: 3,},
				{ownership: 0,x: 0.7,y: 0.4,levelMax: 3,},
				{ownership: 0,x: 0.4,y: 0.65,levelMax: 1,},
				{ownership: 0,x: 0.6,y: 0.65,levelMax: 1,},
				{ownership: 2,x: 0.4,y: 0.85,levelMax: 1,},
				{ownership: 2,x: 0.6,y: 0.85,levelMax: 1,},
			]
		},
		{	name: "Easy 9 - Mining",
			bases:[
					{ownership: 1,x: 0.25,y: 0.55,levelMax: 2,},
					{ownership: 2,x: 0.75,y: 0.3,levelMax: 1,},
					{ownership: 0,x: 0.6,y: 0.4,levelMax: 1,},
					{ownership: 0,x: 0.40,y: 0.75,levelMax: 2,},
					{ownership: 0,x: 0.55,y: 0.60,levelMax: 2,},
					{ownership: 0,x: 0.40,y: 0.30,levelMax: 2,},
				]			
		},
		
		{	name: "Normal Cog",
			bases:[
					{ownership: 0,x: 0.5,y: 0.3,levelMax: 2,},
					{ownership: 0,x: 0.775,y: 0.2,levelMax: 2,},
					{ownership: 1,x: 0.9,y: 0.425,levelMax: 2,},
					{ownership: 0,x: 0.675,y: 0.6,levelMax: 2,},
					{ownership: 0,x: 0.625,y: 0.875,levelMax: 2,},
					{ownership: 2,x: 0.375,y: 0.875,levelMax: 2,},
					{ownership: 0,x: 0.325,y: 0.6,levelMax: 2,},
					{ownership: 0,x: 0.1,y: 0.425,levelMax: 2,},
					{ownership: 3,x: 0.225,y: 0.2,levelMax: 2,},
					{ownership: 0,x: 0.5,y: 0.5,levelMax: 1,},
				]			
		},
		{	name: "Normal Circle",
			bases:[
					{ownership: 0,x: 0.5,y: 0.1,levelMax: 1,},
					{ownership: 0,x: 0.7,y: 0.15,levelMax: 2,},
					{ownership: 0,x: 0.85,y: 0.3,levelMax: 1,},
					{ownership: 3,x: 0.9,y: 0.5,levelMax: 3,},
					{ownership: 0,x: 0.85,y: 0.7,levelMax: 1,},
					{ownership: 0,x: 0.7,y: 0.85,levelMax: 2,},
					{ownership: 0,x: 0.5,y: 0.9,levelMax: 1,},
					{ownership: 2,x: 0.3,y: 0.85,levelMax: 3,},
					{ownership: 0,x: 0.15,y: 0.7,levelMax: 1,},
					{ownership: 0,x: 0.1,y: 0.5,levelMax: 2,},
					{ownership: 0,x: 0.15,y: 0.3,levelMax: 1,},
					{ownership: 1,x: 0.3,y: 0.15,levelMax: 3,},
				]
		},
		{	name: "Normal Triangle",
			bases:[
					{ownership: 1,x: 0.125,y: 0.125,levelMax: 2,},
					{ownership: 0,x: 0.375,y: 0.125,levelMax: 1,},
					{ownership: 0,x: 0.625,y: 0.125,levelMax: 1,},
					{ownership: 2,x: 0.875,y: 0.125,levelMax: 2,},
					{ownership: 0,x: 0.25,y: 0.375,levelMax: 1,},
					{ownership: 0, x: 0.5,y: 0.375,levelMax: 3,	},
					{ownership: 0, x: 0.75,y: 0.375,levelMax: 1,},
					{ownership: 0,x: 0.375,y: 0.625,levelMax: 1,},
					{ownership: 0, x: 0.625,y: 0.625,levelMax: 1,},
					{ownership: 3,x: 0.5,y: 0.875,levelMax: 2,},
				]
		},
		{	name: "Normal A level",
			bases:[
					{ownership: 0,x: 0.72275,y: 0.11419,levelMax: 1,},
					{ownership: 2,x: 0.27725,y: 0.11419,levelMax: 1,},
					{ownership: 1,x: 0.27725,y: 0.88581,levelMax: 1,},
					{ownership: 0,x: 0.72275,y: 0.88581,levelMax: 1,},
					{ownership: 3,x: 0.797,y: 0.5,levelMax: 2,},
					{ownership: 0,x: 0.6485,y: 0.24279,levelMax: 2,},
					{ownership: 0,x: 0.3515,y: 0.24279,levelMax: 2,},
					{ownership: 0,x: 0.203,y: 0.5,levelMax: 2,},
					{ownership: 0,x: 0.3515,y: 0.75721,levelMax: 2,},
					{ownership: 0,x: 0.6485,y: 0.75721,levelMax: 2,},
					{ownership: 0,x: 0.5,y: 0.5,levelMax: 3,},
				]
		},
		{	name: "Normal A level",
			bases:[
					{ownership: 1,x: 0.797,y: 0.5,levelMax: 3,},
					{ownership: 0,x: 0.6485,y: 0.24279,levelMax: 3,},
					{ownership: 2,x: 0.3515,y: 0.24279,levelMax: 3,},
					{ownership: 0,x: 0.203,y: 0.5,levelMax: 3,},
					{ownership: 3,x: 0.3515,y: 0.75721,levelMax: 3,},
					{ownership: 0,x: 0.6485,y: 0.75721,levelMax: 3,},
				]
		},
		{	name: "Normal A level",
			bases:[
					{ownership: 1,x: 0.1,y: 0.5,levelMax: 3,},
					{ownership: 2,x: 0.85,y: 0.93301,levelMax: 3,},
					{ownership: 3,x: 0.85,y: 0.06699,levelMax: 3,},
					{ownership: 0,x: 0.2875,y: 0.60825,levelMax: 1,},
					{ownership: 0,x: 0.475,y: 0.71651,levelMax: 2,},
					{ownership: 0,x: 0.6625,y: 0.82476,levelMax: 1,},
					{ownership: 0,x: 0.85,y: 0.71651,levelMax: 1,},
					{ownership: 0,x: 0.85,y: 0.5,levelMax: 2,},
					{ownership: 0,x: 0.85,y: 0.28349,levelMax: 1,},
					{ownership: 0,x: 0.6625,y: 0.17524,levelMax: 1,},
					{ownership: 0,x: 0.475,y: 0.28349,levelMax: 2,},
					{ownership: 0,x: 0.2875,y: 0.39175,levelMax: 1,},
					{ownership: 0,x: 0.35,y: 0.5,levelMax: 1,},
					{ownership: 0,x: 0.6,y: 0.5,levelMax: 2,},
					]
		},
		{	name: "Normal Parallel",
			bases:[
					{ownership: 2,x: 0.2,y: 0.2,levelMax: 2,},
					{ownership: 1,x: 0.2,y: 0.4,levelMax: 2,},
					{ownership: 3,x: 0.2,y: 0.6,levelMax: 2,},
					{ownership: 0,x: 0.4,y: 0.3,levelMax: 1,},
					{ownership: 0,x: 0.4,y: 0.5,levelMax: 1,},
					{ownership: 0,x: 0.4,y: 0.7,levelMax: 1,},
					{ownership: 0,x: 0.6,y: 0.4,levelMax: 1,},
					{ownership: 0,x: 0.6,y: 0.6,levelMax: 1,},
					{ownership: 0,x: 0.6,y: 0.8,levelMax: 1,},
					{ownership: 0,x: 0.8,y: 0.5,levelMax: 1,},
					{ownership: 0,x: 0.8,y: 0.7,levelMax: 1,},
					{ownership: 0,x: 0.8,y: 0.9,levelMax: 1,},
				]
		},
		{	name: "Normal Cross",
			bases:[
					{ownership: 1,y: 0.5,	x: 0.5,levelMax: 3,},
					{ownership: 0,y: 0.325,	x: 0.45,levelMax: 1,},
					{ownership: 0,y: 0.225,	x: 0.55,levelMax: 1,},
					{ownership: 0,y: 0.5,	x: 0.9,levelMax: 1,},
					{ownership: 0,y: 0.5,	x: 0.1,levelMax: 1,},
					{ownership: 0,y: 0.675,	x: 0.55,levelMax: 1,	},
					{ownership: 0,y: 0.775,	x: 0.45,levelMax: 1,},
					{ownership: 2,y: 0.1,	x: 0.5,levelMax: 2,},
					{ownership: 3,y: 0.9,	x: 0.5,levelMax: 2,},
				]
		},
		{	name: "Normal Squeezed",
			bases:[
					{ownership: 1,x: 0.5,y: 0.5,levelMax: 3,},
					{ownership: 0,x: 0.5,y: 0.75,levelMax: 1,},
					{ownership: 0,x: 0.5,y: 0.25,levelMax: 1,},
					{ownership: 2,x: 0.1,y: 0.1,levelMax: 2,},
					{ownership: 0,x: 0.1,y: 0.25,levelMax: 1,},
					{ownership: 0,x: 0.5,y: 0.1,levelMax: 1,},
					{ownership: 3,x: 0.9,y: 0.9,levelMax: 2,},
					{ownership: 0,x: 0.5,y: 0.9,levelMax: 1,},
					{ownership: 0,x: 0.9,y: 0.75,levelMax: 1,},
				]
		},
		{	name: "Hard Unfair triangle",
			bases:[
					{ownership: 1,x: 0.1,y: 0.5,levelMax: 1,},
					{ownership: 0,x: 0.3,y: 0.6,levelMax: 1,},
					{ownership: 0,x: 0.3,y: 0.4,levelMax: 1,},
					{ownership: 2,x: 0.9,y: 0.9,levelMax: 2,},
					{ownership: 0,x: 0.7,y: 0.8,levelMax: 2,},
					{ownership: 0,x: 0.9,y: 0.7,levelMax: 2,},
					{ownership: 3,x: 0.9,y: 0.1,levelMax: 2,},
					{ownership: 0,x: 0.9,y: 0.3,levelMax: 2,},
					{ownership: 0,x: 0.7,y: 0.2,levelMax: 2,},
				]
		},
		{	name: "Hard Circle mildly unfair",
			bases:[
					{ownership: 1,x: 0.5,y: 0.9,levelMax: 2,},
					{ownership: 0,x: 0.75712,y: 0.80642,levelMax: 1,},
					{ownership: 0,x: 0.24288,y: 0.80642,levelMax: 1,},
					{ownership: 2,x: 0.15359,y: 0.3,levelMax: 3,},
					{ownership: 0,x: 0.10608,y: 0.56946,levelMax: 2,},
					{ownership: 0,x: 0.36319,y: 0.12412,levelMax: 2,},
					{ownership: 3,x: 0.84641,y: 0.3,levelMax: 3,},
					{ownership: 0,x: 0.89392,y: 0.56946,levelMax: 2,},
					{ownership: 0,x: 0.63681,y: 0.12412,levelMax: 2,},
				]
		},
		{	name: "Hard Rotated squares",
			bases:[
					{ownership: 1,x: 0.5,y: 0.91213,levelMax: 1,},
					{ownership: 0,x: 0.71213,y: 0.7,levelMax: 1,},
					{ownership: 0,x: 0.5,y: 0.48787,levelMax: 1,},
					{ownership: 0,x: 0.28787,y: 0.7,levelMax: 1,},
					{ownership: 2,x: 0.1,y: 0.1,levelMax: 1,},
					{ownership: 0,x: 0.4,y: 0.1,levelMax: 2,},
					{ownership: 0,x: 0.4,y: 0.4,levelMax: 1,},
					{ownership: 0,x: 0.1,y: 0.4,levelMax: 2,},
					{ownership: 0,x: 0.1,y: 0.4,levelMax: 2,},
					{ownership: 3,x: 0.9,y: 0.1,levelMax: 1,},
					{ownership: 0,x: 0.9,y: 0.4,levelMax: 2,},
					{ownership: 0,x: 0.6,y: 0.4,levelMax: 1,},
					{ownership: 0,x: 0.6,y: 0.1,levelMax: 2,},
				]
		},
		{	name: "Hard Gem mildly unfair",
			bases:[
					{ownership:1,x:0.5,y:0.9,levelMax:1,},
					{ownership:0,x:0.36667,y:0.63333,levelMax: 	1,},
					{ownership:0,x:0.63333,y:0.63333,levelMax: 	1,},
					{ownership:2,x:0.1,y:0.1,levelMax:3,},
					{ownership:0,x:0.36667,y:0.1,levelMax: 	1,},
					{ownership:0,x:0.23333,y:0.36667,levelMax:1,},
					{ownership:3,x:0.9,y:0.1,levelMax:3,},
					{ownership:0,x:0.63333,y:0.1,levelMax:1,},
					{ownership:0,x:0.5,y:0.36667,levelMax: 	3,},
					{ownership:0,x:0.76667,y:0.36667,levelMax: 	1,},
				]
		},
		{	name: "Hard Helix mildly unfair",
			bases:[
					{ownership:1,x:0.5,y:0.1,levelMax:1,},
					{ownership:0,x:0.5,y:0.3,levelMax:1,},
					{ownership:0,x:0.5,y:0.5,levelMax: 	1,},
					{ownership:0,x:0.3	,y:0.7	,levelMax:1	,},
					{ownership:2,x:0.1,y:0.9,levelMax:2,},
					{ownership:0,x:0.7,y:0.7,levelMax:1,},
					{ownership:3,x:0.9	,y:0.9	,levelMax: 	2,},
				]
		},
		{	name: "Hard Middle square",
			bases:[
					{ownership:1,x:0.5,y:0.15,levelMax:1,},
					{ownership:0,x:0.4,y:0.4,levelMax:1,},
					{ownership:0,x:0.4,y:0.6,levelMax:1,},
					{ownership:0,x:0.6,y:0.6,levelMax:1,},
					{ownership:0,x:0.6,y:0.4,levelMax:1,},
					{ownership:2,x:0.8,y:0.8,levelMax:2,},
					{ownership:3,x:0.2,y:0.8,levelMax:2,},
				]
		},
		{	name: "Hard Drop on top",
			bases:[
					{ownership:1,x:0.5,y:0.1,levelMax:1,},
					{ownership:0,x:0.5,y:0.3,levelMax:1,},
					{ownership:0,x:0.3,y:0.6,levelMax:1,},
					{ownership:0,x:0.7,y:0.6,levelMax:1,},
					{ownership:0,x:0.5,y:0.9,levelMax:1,},
					{ownership:2,x:0.1,y:0.9,levelMax:2,},
					{ownership:3,x:0.9,y:0.9,levelMax:2,},
				]
		},
		{	name: "Hard Twisted square mild unfair",
			bases:[
					{ownership: 1,x: 0.5,y: 0.9,levelMax: 1,},
					{ownership: 0,x: 0.5,y: 0.6,levelMax: 1,},
					{ownership: 0,x: 0.3,y: 0.4,levelMax: 1,},
					{ownership: 0,x: 0.5,y: 0.2,levelMax: 1,},
					{ownership: 0,x: 0.7,y: 0.4,levelMax: 1,},
					{ownership: 2,x: 0.1,y: 0.1,levelMax: 2,},
					{ownership: 3,x: 0.9,y: 0.1,levelMax: 2,},	
				]
		},
		{	name: "Hard Initial handicap",
			bases:[
					{ownership: 1,x: 0.5,y: 0.9,levelMax: 2,},
					{ownership: 0,x: 0.24,y: 0.8,levelMax: 1,},
					{ownership: 0,x: 0.106,y: 0.57,levelMax: 1,},
					{ownership: 0,x: 0.757,y: 0.8,levelMax: 1,},
					{ownership: 0,x: 0.89,y: 0.57,levelMax: 1,},
					{ownership: 2,x: 0.846,y: 0.3,levelMax: 2,},
					{ownership: 2,x: 0.636,y: 0.124,levelMax: 1,},
					{ownership: 3,x: 0.15,y: 0.3,levelMax: 2,},	
					{ownership: 3,x: 0.363,y: 0.124,levelMax: 1,},
				]
		},
		{	name: "1-1 wave",
			bases:[
					{ownership: 1,y: 0.1,	x: 0.5,levelMax: 2,},
					{ownership: 0,y: 0.1,	x: 0.3,levelMax: 1,},
					{ownership: 0,y: 0.36,	x: 0.3,levelMax: 1,},
					{ownership: 0,y: 0.5,	x: 0.5,levelMax: 2,},
					{ownership: 0,y: 0.633,	x: 0.7,levelMax: 1,},
					{ownership: 0,y: 0.9,	x: 0.7,levelMax: 1,},
					{ownership: 3,y: 0.9,	x: 0.5,levelMax: 2,},	
				]
		},
		{	name: "1-1 squares",
			bases:[
					{ownership: 1,x: 0.15,y: 0.85,levelMax: 1,},
					{ownership: 0,x: 0.85,y: 0.85,levelMax: 3,},
					{ownership: 2,x: 0.85,y: 0.15,levelMax: 1,},
					{ownership: 0,x: 0.15,y: 0.15,levelMax: 3,},
					{ownership: 0,x: 0.3,y: 0.7,levelMax: 1,},
					{ownership: 0,x: 0.7,y: 0.7,levelMax: 1,},
					{ownership: 0,x: 0.7,y: 0.3,levelMax: 1,},
					{ownership: 0,x: 0.3,y: 0.3,levelMax: 1,},
					{ownership: 0,x: 0.5,y: 0.5,levelMax: 2,},	
				]
		},
		{	name: "1-1 minimal",
			bases:[
					{ownership: 0,y: 0.15,x: 0.7,levelMax: 2,},
					{ownership: 0,y: 0.85,x: 0.7,levelMax: 2,},
					{ownership: 0,y: 0.85,x: 0.3,levelMax: 2,},
					{ownership: 0,y: 0.15,x: 0.3,levelMax: 2,},
					{ownership: 1,y: 0.35,x: 0.5,levelMax: 1,},
					{ownership: 3,y: 0.65,x: 0.5,levelMax: 1,},
				]
		},
		{	name: "1-1 cross",
			bases:[
					{ownership: 0,x: 0.1,y: 0.5,levelMax: 1,},
					{ownership: 1,x: 0.3,y: 0.5,levelMax: 2,},
					{ownership: 0,x: 0.5,y: 0.5,levelMax: 1,},
					{ownership: 3,x: 0.7,y: 0.5,levelMax: 2,},
					{ownership: 0,x: 0.9,y: 0.5,levelMax: 1,},
					{ownership: 0,x: 0.5,y: 0.9,levelMax: 1,},
					{ownership: 0,x: 0.5,y: 0.7,levelMax: 1,},
					{ownership: 0,x: 0.5,y: 0.3,levelMax: 1,},
					{ownership: 0,x: 0.5,y: 0.1,levelMax: 1,},
				]
		},
		{	name: "1-1 diamond core",
			bases:[
					{ownership: 1,x: 0.1,y: 0.5,levelMax: 1,},
					{ownership: 3,x: 0.9,y: 0.5,levelMax: 1,},
					{ownership: 0,x: 0.5,y: 0.5,levelMax: 2,},

					{ownership: 0,x: 0.3,y: 0.65,levelMax: 1,},
					{ownership: 0,x: 0.5,y: 0.8,levelMax: 1,},
					{ownership: 0,x: 0.7,y: 0.65,levelMax: 1,},
					{ownership: 0,x: 0.3,y: 0.35,levelMax: 1,},
					{ownership: 0,x: 0.5,y: 0.2,levelMax: 1,},
					{ownership: 0,x: 0.7,y: 0.35,levelMax: 1,},
				]
		},
		{	name: "1-1 diamond no core",
			bases:[
					{ownership: 1,x: 0.1,y: 0.5,levelMax: 1,},
					{ownership: 3,x: 0.9,y: 0.5,levelMax: 1,},

					{ownership: 0,x: 0.3,y: 0.65,levelMax: 1,},
					{ownership: 0,x: 0.5,y: 0.8,levelMax: 2,},
					{ownership: 0,x: 0.7,y: 0.65,levelMax: 1,},
					{ownership: 0,x: 0.3,y: 0.35,levelMax: 1,},
					{ownership: 0,x: 0.5,y: 0.2,levelMax: 2,},
					{ownership: 0,x: 0.7,y: 0.35,levelMax: 1,},
				]
		},
		{	name: "1-1 ranks",
			bases:[
					{ownership: 0,x: 0.5,y: 0.5,levelMax: 3,},
					
					{ownership: 1,x: 0.2,y: 0.5,levelMax: 1,},
					{ownership: 0,x: 0.2,y: 0.9,levelMax: 1,},
					{ownership: 0,x: 0.2,y: 0.7,levelMax: 1,},
					{ownership: 0,x: 0.2,y: 0.3,levelMax: 1,},
					{ownership: 0,x: 0.2,y: 0.1,levelMax: 1,},
					
					{ownership: 3,x: 0.8,y: 0.5,levelMax: 1,},
					{ownership: 0,x: 0.8,y: 0.9,levelMax: 1,},
					{ownership: 0,x: 0.8,y: 0.7,levelMax: 1,},
					{ownership: 0,x: 0.8,y: 0.3,levelMax: 1,},
					{ownership: 0,x: 0.8,y: 0.1,levelMax: 1,},
				]
		},
		{	name: "1-1 front lines",
			bases:[
					{ownership: 1,y: 0.2,x: 0.5,levelMax: 2,},
					{ownership: 3,y: 0.8,x: 0.5,levelMax: 2,},
					{ownership: 0,y: 0.4,x: 0.5,levelMax: 1,},
					{ownership: 0,y: 0.4,x: 0.9,levelMax: 1,},
					{ownership: 0,y: 0.4,x: 0.1,levelMax: 1,},
					{ownership: 0,y: 0.6,x: 0.5,levelMax: 1,},
					{ownership: 0,y: 0.6,x: 0.9,levelMax: 1,},
					{ownership: 0,y: 0.6,x: 0.1,levelMax: 1,},
				]
		},
		{	name: "1-1 squares + 2",
			bases:[
					{ownership: 0,x: 0.15,y: 0.85,levelMax: 2,},
					{ownership: 0,x: 0.85,y: 0.85,levelMax: 2,},
					{ownership: 0,x: 0.85,y: 0.15,levelMax: 2,},
					{ownership: 0,x: 0.15,y: 0.15,levelMax: 2,},
					
					{ownership: 0,x: 0.3,y: 0.7,levelMax: 1,},
					{ownership: 0,x: 0.7,y: 0.7,levelMax: 1,},
					{ownership: 0,x: 0.7,y: 0.3,levelMax: 1,},
					{ownership: 0,x: 0.3,y: 0.3,levelMax: 1,},
					
					{ownership: 0,x: 0.5,y: 0.5,levelMax: 2,},	
					
					{ownership: 1,x: 0.15,y: 0.5,levelMax: 1,},
					{ownership: 3,x: 0.85,y: 0.5,levelMax: 1,},
				]
		},
		{	name: "Test Level",
			bases:[
					{ownership: 1,x: 0.3,y: 0.3,levelMax: 2,},
					{ownership: 1,x: 0.3,y: 0.5,levelMax: 1,},
					{ownership: 1,x: 0.3,y: 0.7,levelMax: 1,},
					{ownership: 2,x: 0.6,y: 0.5,levelMax: 1,},	
				]
		},
		{name:"Custom Level",
		  bases:[
			{ownership:1,x:0.30,y:0.20,levelMax:1},
			{ownership:0,x:0.60,y:0.20,levelMax:1},
			{ownership:0,x:0.15,y:0.40,levelMax:2},
			{ownership:0,x:0.41,y:0.40,levelMax:1},
			{ownership:0,x:0.64,y:0.40,levelMax:1},
			{ownership:0,x:0.89,y:0.40,levelMax:1},
			{ownership:0,x:0.52,y:0.56,levelMax:1},
			{ownership:2,x:0.53,y:0.70,levelMax:1},
			{ownership:0,x:0.22,y:0.85,levelMax:2},
			{ownership:0,x:0.79,y:0.85,levelMax:1},
			{ownership:0,x:0.77,y:0.27,levelMax:1},
			{ownership:0,x:0.49,y:0.30,levelMax:1},
			{ownership:0,x:0.23,y:0.31,levelMax:2},
			{ownership:3,x:0.27,y:0.55,levelMax:1},
			{ownership:0,x:0.76,y:0.53,levelMax:2},
			{ownership:0,x:0.78,y:0.66,levelMax:1},
			{ownership:0,x:0.23,y:0.68,levelMax:1},
			{ownership:0,x:0.50,y:0.84,levelMax:1},
			{ownership:0,x:0.83,y:0.14,levelMax:1},
		  ]
		},
	];
	
//allow for more margins
for (var i = 0; i < levels.length; i++) {
	// indicate margins as a percentage
	var marginLeft = 0.1;
	var marginRight = 0.1;
	var marginTop = 0.05;
	var marginBottom = 0.02;
	
	var shrinkWidth=(1-marginLeft-marginRight);
	var shrinkHeight=(1-marginTop-marginBottom);
	
	var level = levels[i];
	for (var j = 0; j < level.bases.length; j++) {
		levels[i].bases[j].x=level.bases[j].x*shrinkWidth+marginLeft;
		levels[i].bases[j].y=level.bases[j].y*shrinkHeight+marginTop;
	}
}
return levels;
}
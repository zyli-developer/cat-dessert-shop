const fs = require('fs');
const path = require('path');

function optimizeHomeScene() {
    const scenePath = 'client/assets/scenes/Home.scene';
    const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));

    // Find Canvas (usually __id__: 2)
    const canvas = scene[2];
    if (canvas._name !== 'Canvas') {
        console.error('Canvas not found at index 2');
        return;
    }

    const nodeMap = {};
    scene.forEach((obj, index) => {
        if (obj.__type__ === 'cc.Node') {
            nodeMap[obj._name] = index;
        }
    });

    const findComponent = (nodeIdx, type) => {
        const node = scene[nodeIdx];
        for (const compRef of node._components) {
            const comp = scene[compRef.__id__];
            if (comp.__type__ === type) return comp;
        }
        return null;
    };

    const getCompId = (nodeIdx, type) => {
        const node = scene[nodeIdx];
        for (const compRef of node._components) {
            const comp = scene[compRef.__id__];
            if (comp.__type__ === type) return compRef.__id__;
        }
        return null;
    };

    // Helper to create a new node
    const createNode = (name, parentId) => {
        const id = scene.length;
        const node = {
            "__type__": "cc.Node",
            "_name": name,
            "_objFlags": 0,
            "__editorExtras__": {},
            "_parent": { "__id__": parentId },
            "_children": [],
            "_active": true,
            "_components": [],
            "_prefab": null,
            "_lpos": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 },
            "_lrot": { "__type__": "cc.Quat", "x": 0, "y": 0, "z": 0, "w": 1 },
            "_lscale": { "__type__": "cc.Vec3", "x": 1, "y": 1, "z": 1 },
            "_mobility": 0,
            "_layer": 33554432,
            "_euler": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 },
            "_id": ""
        };
        scene.push(node);
        // Add UITransform by default for UI nodes
        const uiTransId = scene.length;
        scene.push({
            "__type__": "cc.UITransform",
            "node": { "__id__": id },
            "_contentSize": { "__type__": "cc.Size", "width": 100, "height": 100 },
            "_anchorPoint": { "__type__": "cc.Vec2", "x": 0.5, "y": 0.5 }
        });
        node._components.push({ "__id__": uiTransId });
        return id;
    };

    const addWidget = (nodeId, flags, opts = {}) => {
        const id = scene.length;
        scene.push({
            "__type__": "cc.cc.Widget", // Wait, it should be cc.Widget
            "__type__": "cc.Widget",
            "node": { "__id__": nodeId },
            "_enabled": true,
            "_alignFlags": flags,
            "_top": opts.top || 0,
            "_bottom": opts.bottom || 0,
            "_left": opts.left || 0,
            "_right": opts.right || 0,
            "_horizontalCenter": opts.horizontalCenter || 0,
            "_verticalCenter": opts.verticalCenter || 0,
            "_isAbsTop": true,
            "_isAbsBottom": true,
            "_isAbsLeft": true,
            "_isAbsRight": true,
            "_alignMode": 2
        });
        scene[nodeId]._components.push({ "__id__": id });
    };

    const addLayout = (nodeId, type, spacing) => {
        const id = scene.length;
        scene.push({
            "__type__": "cc.Layout",
            "node": { "__id__": nodeId },
            "_enabled": true,
            "_layoutType": type, // 1 for Horizontal, 2 for Vertical
            "_spacingX": spacing,
            "_spacingY": spacing,
            "_resizeMode": 1, // CONTAINER
            "_affectedByScale": true
        });
        scene[nodeId]._components.push({ "__id__": id });
    };

    // Create Groups
    const topLeftId = createNode('TopLeftStats', 2);
    addWidget(topLeftId, 9, { top: 80, left: 40 }); // Top | Left
    addLayout(topLeftId, 2, 20); // Vertical

    const topRightId = createNode('TopRightButtons', 2);
    addWidget(topRightId, 33, { top: 80, right: 40 }); // Top | Right
    addLayout(topRightId, 1, 20); // Horizontal

    const bottomNavId = createNode('BottomNavigation', 2);
    addWidget(bottomNavId, 20, { bottom: 100, horizontalCenter: 0 }); // Bottom | HorizontalCenter
    addLayout(bottomNavId, 2, 30); // Vertical

    const buttonsContId = createNode('ButtonsContainer', bottomNavId);
    addLayout(buttonsContId, 1, 40); // Horizontal

    // Reparenting function
    const reparent = (nodeName, newParentId) => {
        const nodeIdx = nodeMap[nodeName];
        if (nodeIdx === undefined) return;
        const node = scene[nodeIdx];
        const oldParentId = node._parent.__id__;
        const oldParent = scene[oldParentId];
        
        // Remove from old parent
        oldParent._children = oldParent._children.filter(c => c.__id__ !== nodeIdx);
        
        // Add to new parent
        node._parent = { "__id__": newParentId };
        scene[newParentId]._children.push({ "__id__": nodeIdx });
    };

    // Reparent nodes
    reparent('TotalStarsLabel', topLeftId);
    reparent('CatCoinLabel', topLeftId);
    reparent('BtnAdCatCoin', topLeftId);

    reparent('BtnRank', topRightId);
    reparent('BtnSettings', topRightId);

    reparent('RoundLabel', bottomNavId);
    reparent('Stars', bottomNavId);
    reparent('BtnPrev', buttonsContId);
    reparent('BtnStart', buttonsContId);
    reparent('BtnNext', buttonsContId);

    // Update Canvas children (add the new groups)
    canvas._children.push({ "__id__": topLeftId });
    canvas._children.push({ "__id__": topRightId });
    canvas._children.push({ "__id__": bottomNavId });

    // Update Labels styling in scene
    const labelNodes = ['RoundLabel', 'Stars', 'CatCoinLabel', 'TotalStarsLabel'];
    labelNodes.forEach(name => {
        const nodeIdx = nodeMap[name];
        if (nodeIdx === undefined) return;
        const label = findComponent(nodeIdx, 'cc.Label');
        if (label) {
            label._isBold = true;
            label._enableOutline = true;
            label._outlineColor = { "__type__": "cc.Color", "r": 0, "g": 0, "b": 0, "a": 150 };
            label._outlineWidth = 3;
            label._enableShadow = true;
            label._shadowColor = { "__type__": "cc.Color", "r": 0, "g": 0, "b": 0, "a": 80 };
            label._shadowOffset = { "__type__": "cc.Vec2", "x": 1, "y": -1 };
            label._shadowBlur = 2;
        }
    });

    // Update HomeScene component properties
    const homeSceneComp = scene.find(obj => obj.__type__ === '9ca272zo0NDr6cTBRKBg+7G');
    if (homeSceneComp) {
        homeSceneComp.roundLabel = { "__id__": getCompId(nodeMap['RoundLabel'], 'cc.Label') };
        homeSceneComp.starsLabel = { "__id__": getCompId(nodeMap['Stars'], 'cc.Label') };
        homeSceneComp.catCoinLabel = { "__id__": getCompId(nodeMap['CatCoinLabel'], 'cc.Label') };
        homeSceneComp.totalStarsLabel = { "__id__": getCompId(nodeMap['TotalStarsLabel'], 'cc.Label') };
        homeSceneComp.btnStart = { "__id__": nodeMap['BtnStart'] };
        homeSceneComp.btnPrev = { "__id__": nodeMap['BtnPrev'] };
        homeSceneComp.btnNext = { "__id__": nodeMap['BtnNext'] };
        homeSceneComp.btnRank = { "__id__": nodeMap['BtnRank'] };
        homeSceneComp.btnSettings = { "__id__": nodeMap['BtnSettings'] };
        homeSceneComp.btnAdCatCoin = { "__id__": nodeMap['BtnAdCatCoin'] };
    }

    fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2));
    console.log('Home.scene optimized');
}

function optimizeGameScene() {
    const scenePath = 'client/assets/scenes/Game.scene';
    const scene = JSON.parse(fs.readFileSync(scenePath, 'utf8'));

    const canvas = scene.find(obj => obj.__type__ === 'cc.Node' && obj._name === 'Canvas');
    const canvasId = scene.indexOf(canvas);

    const nodeMap = {};
    scene.forEach((obj, index) => {
        if (obj.__type__ === 'cc.Node') {
            nodeMap[obj._name] = index;
        }
    });

    const findComponent = (nodeIdx, type) => {
        const node = scene[nodeIdx];
        for (const compRef of node._components) {
            const comp = scene[compRef.__id__];
            if (comp.__type__ === type) return comp;
        }
        return null;
    };

    // Update HUD Labels styling
    const hudLabels = ['GoldLabel', 'ScoreLabel', 'RoundLabel'];
    hudLabels.forEach(name => {
        const nodeIdx = nodeMap[name];
        if (nodeIdx === undefined) return;
        const label = findComponent(nodeIdx, 'cc.Label');
        if (label) {
            label._isBold = true;
            label._enableOutline = true;
            label._outlineColor = { "__type__": "cc.Color", "r": 0, "g": 0, "b": 0, "a": 150 };
            label._outlineWidth = 3;
            label._enableShadow = true;
            label._shadowColor = { "__type__": "cc.Color", "r": 0, "g": 0, "b": 0, "a": 80 };
            label._shadowOffset = { "__type__": "cc.Vec2", "x": 1, "y": -1 };
            label._shadowBlur = 2;
        }
    });

    // Group HUD in TopLeft
    // Group Buttons in TopRight
    
    // Create Groups
    const createNode = (name, parentId) => {
        const id = scene.length;
        const node = {
            "__type__": "cc.Node",
            "_name": name,
            "_objFlags": 0,
            "__editorExtras__": {},
            "_parent": { "__id__": parentId },
            "_children": [],
            "_active": true,
            "_components": [],
            "_prefab": null,
            "_lpos": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 },
            "_lrot": { "__type__": "cc.Quat", "x": 0, "y": 0, "z": 0, "w": 1 },
            "_lscale": { "__type__": "cc.Vec3", "x": 1, "y": 1, "z": 1 },
            "_mobility": 0,
            "_layer": 33554432,
            "_euler": { "__type__": "cc.Vec3", "x": 0, "y": 0, "z": 0 },
            "_id": ""
        };
        scene.push(node);
        const uiTransId = scene.length;
        scene.push({
            "__type__": "cc.UITransform",
            "node": { "__id__": id },
            "_contentSize": { "__type__": "cc.Size", "width": 100, "height": 100 },
            "_anchorPoint": { "__type__": "cc.Vec2", "x": 0.5, "y": 0.5 }
        });
        node._components.push({ "__id__": uiTransId });
        return id;
    };

    const addWidget = (nodeId, flags, opts = {}) => {
        const id = scene.length;
        scene.push({
            "__type__": "cc.Widget",
            "node": { "__id__": nodeId },
            "_enabled": true,
            "_alignFlags": flags,
            "_top": opts.top || 0,
            "_bottom": opts.bottom || 0,
            "_left": opts.left || 0,
            "_right": opts.right || 0,
            "_horizontalCenter": opts.horizontalCenter || 0,
            "_verticalCenter": opts.verticalCenter || 0,
            "_isAbsTop": true,
            "_isAbsBottom": true,
            "_isAbsLeft": true,
            "_isAbsRight": true,
            "_alignMode": 2
        });
        scene[nodeId]._components.push({ "__id__": id });
    };

    const addLayout = (nodeId, type, spacing) => {
        const id = scene.length;
        scene.push({
            "__type__": "cc.Layout",
            "node": { "__id__": nodeId },
            "_enabled": true,
            "_layoutType": type,
            "_spacingX": spacing,
            "_spacingY": spacing,
            "_resizeMode": 1,
            "_affectedByScale": true
        });
        scene[nodeId]._components.push({ "__id__": id });
    };

    const hudGroupIdx = createNode('HUDGroup', canvasId);
    addWidget(hudGroupIdx, 9, { top: 60, left: 30 });
    addLayout(hudGroupIdx, 2, 15);

    const btnGroupIdx = createNode('ButtonGroup', canvasId);
    addWidget(btnGroupIdx, 33, { top: 60, right: 30 });
    addLayout(btnGroupIdx, 1, 15);

    const reparent = (nodeName, newParentId) => {
        const nodeIdx = nodeMap[nodeName];
        if (nodeIdx === undefined) return;
        const node = scene[nodeIdx];
        const oldParentId = node._parent.__id__;
        const oldParent = scene[oldParentId];
        oldParent._children = oldParent._children.filter(c => c.__id__ !== nodeIdx);
        node._parent = { "__id__": newParentId };
        scene[newParentId]._children.push({ "__id__": nodeIdx });
    };

    reparent('GoldLabel', hudGroupIdx);
    reparent('ScoreLabel', hudGroupIdx);
    reparent('RoundLabel', hudGroupIdx);

    reparent('BtnPause', btnGroupIdx);
    reparent('BtnHammer', btnGroupIdx);
    reparent('BtnShuffle', btnGroupIdx);
    reparent('BtnAd', btnGroupIdx);

    canvas._children.push({ "__id__": hudGroupIdx });
    canvas._children.push({ "__id__": btnGroupIdx });

    fs.writeFileSync(scenePath, JSON.stringify(scene, null, 2));
    console.log('Game.scene optimized');
}

optimizeHomeScene();
optimizeGameScene();


let usedModules = [
    "co-2x2-core", 
    "co-hardcraft",
    //"co-disable-default-slabs", // if you used Polymorph, you can disable it
    "co-disable-default-stairs", 
    //"co-disable-default-pressure-plates", // recommended for balance, if enabled "co-3x1-pressure-plates", required if you not used Polymorph mod
    "co-2x2-extra-cut-copper",
    "co-2x2-extra-log-crafts", 
    "co-2x2-items", 
    "co-2x1-slabs", 
    "co-1x1-slabs", // may require `allowVanillaRecipeConflicts` and Polymorph mod
    "co-2x2-stairs",
    "co-3x3-more-stairs",
    //"co-3x1-pressure-plates",
    "co-2x2-extra-unpackable",
    "co-2x2-more-bark",
    "co-2x2-extra-polymorph", // conflicts with modified 2x2 crafting recipes, required Polymorph mod for resolve it
    "co-extra-better-dyeables",
    "vt-powder-to-glass", 
    "vt-slabs-stairs-to-block", // may require `allowVanillaRecipeConflicts` and Polymorph mod
    "vt-straight-to-shapeless"
];

//
let experimentalDatapacks = true; // required Fabric mod!
let mergeVersions = true; // currently, incompatible with most built-in advancements!
let allowVanillaRecipeConflicts = true; // required Polymorph mod!
let usedMCVersion = "1_19";

//
let srcDir = `../wrapper/datapacks/`;
let dstDir = `../src/main/resources/resourcepacks/crop`;
let dataIdentifier = `crop`;

//
let disallowedData = {
    "1_20": [],
    "1_19": ["1.20"],//["1_19", "1_18", "1_17", "1_16", "1_xx"],
    "1_18": ["1.20", "1_19"],//["1_18", "1_17", "1_16", "1_xx"],
    "1_17": ["1.20", "1_19", "1_18"],//["1_17", "1_16", "1_xx"],
    "1_16": ["1.20", "1_19", "1_18", "1_17"],//["1_16", "1_xx"]
    "1_15": ["1.20", "1_19", "1_18", "1_17", "1_16"],
    "1_xx": ["1.20", "1_19", "1_18", "1_17", "1_16"]
};

let dataVersion = {
    "1_20": 10,
    "1_19": 10,
    "1_18": 9,
    "1_17": 8,
    "1_16": 7,
    "1_15": 6,
    "1_xx": 6
};

let mcVersionString = {
    "1_20": "1.20.x",
    "1_19": "1.19.x",
    "1_18": "1.18.x",
    "1_17": "1.17.x",
    "1_16": "1.16.x",
    "1_15": "1.15.x",
    "1_xx": "1.15.x"
};

// 
let mcVersions = ["1_20", "1_19", "1_18", "1_17", "1_16", "1_15", "1_14", "1_13", "1_xx"];

//
let path = require('path');
let fs = require('fs');
let fse = require('fs-extra');
let {crlf, LF, CRLF, CR} = require('crlf-normalize');

/////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////// Smart Merging Directories Library ///////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////

//
const stripComments = (data => data.replace(/\\"|"(?:\\"|[^"])*"|(\/\/.*|\/\*[\s\S]*?\*\/)/g, (m, g) => g ? "" : m));

//
function isJsonString(str) {
    try {
        JSON.parse(str);
    } catch (e) {
        return false;
    }
    return true;
}

//
const arrayMerge = (target, source, options = {}) => {
    target = target || source || [];
    if (source.some(Array.isArray)) {
        return (target = recursiveMerge(target, source, options)); // try to merge two arrays manually, but there is no correct position detection
    } else 
    if (source.some(e => (typeof e == "object"))) {
        // merge only if dublicated as string
        return (target = Array.from(new Set([
            ...(target||[]).map((o,i)=>{ return (typeof o == "object") ? JSON.stringify(o) : o; }), 
            ...(source||[]).map((o,i)=>{ return (typeof o == "object") ? JSON.stringify(o) : o; }), 
        ])).map((o,i)=>{ return isJsonString(o) ? JSON.parse(o) : o; }));
    } else 
    {
        return (target = Array.from(new Set([
            ...(target||[]), 
            ...(source||[])
        ])));
    };
};

//
const objectMerge = (target, source, options = {}) => {
    target = target || source || {};
    if (Array.isArray(source)) { target = arrayMerge( target, source, options); } else
    if (typeof source == "object") { target = recursiveMerge(target, source, options); } else
    { target = source; };
    return target;
};

//
const recursiveMerge = (target, source, options = {}) => {
    target = target || source || {};
    if (typeof source == "object") {
        for (let key in source) {
            target[key] = objectMerge(target[key], source[key], options);
        }
    } else 
    if (Array.isArray(source)) {
        for (let key = 0; key < source.length; key++) {
            target[key] = objectMerge(target[key], source[key], options);
        }
    }
    return target;
};

//
const propertiesToJson = require('properties-file').propertiesToJson;
const jsonToProperties = (obj)=>{
    let props = [];
    for (var el in obj) { props.push(el + " = " + obj[el]); }
    return props.join("\n");
}

// TODO: remake function
let copyFolderRecursiveSync = (src, dest, options = {}) => {
    let exists = fs.existsSync(src);
    let stats = exists && fs.statSync(src);
    let isDirectory = exists && stats.isDirectory();
    if (isDirectory) {
        fs.mkdirSync(dest, { recursive: true });
        fs.readdirSync(src).forEach(function(childItemName) {
            copyFolderRecursiveSync(path.join(src, childItemName), path.join(dest, childItemName));
        });
    } else {
        if (fs.existsSync(dest)) {
            let dstMatched = dest.match(/\.[0-9a-z]+$/i);
            let srcMatched = src.match(/\.[0-9a-z]+$/i);
            if (dstMatched && srcMatched && srcMatched[0] == ".properties" && dstMatched[0] == ".properties") {
                //
                console.log("merging PROPERTIES " + src + " to " + dest);
                
                //
                let srcJsonRaw = propertiesToJson(fs.readFileSync(src, "utf8"));
                let dstJsonRaw = propertiesToJson(fs.readFileSync(dest, "utf8"));
                let srcJson = JSON.parse(srcJsonRaw);
                let dstJson = JSON.parse(dstJsonRaw);
                
                //
                console.log("SRC PROPERTIES: " + jsonToProperties(srcJsonRaw));
                console.log("DST PROPERTIES: " + jsonToProperties(dstJsonRaw));
                console.log("RESULT PROPERTIES: " + jsonToProperties(objectMerge(dstJson, srcJson)));
                
                //
                fs.rmSync(dest);
                fs.writeFileSync(dest, jsonToProperties(objectMerge(dstJson, srcJson)));
            } else
            if (dstMatched && srcMatched && srcMatched[0] == ".json" && dstMatched[0] == ".json") {
                //
                //console.log("merging JSON " + src + " to " + dest);
                
                //
                let srcJsonRaw = stripComments(fs.readFileSync(src, "utf8")).replaceAll("}{}", "}").replaceAll("}{","}").trim();
                let dstJsonRaw = stripComments(fs.readFileSync(dest, "utf8")).replaceAll("}{}", "}").replaceAll("}{","}").trim();
                let srcJson = JSON.parse(srcJsonRaw);
                let dstJson = JSON.parse(dstJsonRaw);
                
                //
                //console.log("SRC JSON: " + JSON.stringify(srcJsonRaw));
                //console.log("DST JSON: " + JSON.stringify(dstJsonRaw));
                //console.log("RESULT JSON: " + JSON.stringify(objectMerge(dstJson, srcJson)));
                
                //
                fs.rmSync(dest);
                fs.writeFileSync(dest, stripComments(JSON.stringify(objectMerge(dstJson, srcJson), null, 4).replaceAll("}{}", "}").replaceAll("}{","}"), "utf8").trim());
            } else {
                fs.copyFileSync(src, dest);
            }
        } else {
            fs.copyFileSync(src, dest);
        }
    }
};

//
let mergeDirectories = (inputs, target, options = {}) => {
    Array.from(inputs).forEach((filename)=>{
        copyFolderRecursiveSync(filename, target);
    });
};

/////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////

// will used in future
let blocks = JSON.parse(fs.readFileSync("./blocks.json", "utf8"));

// 
let templateStub = (options)=>{
    return crlf(JSON.stringify({
        "type": "crafting_shapeless",
        "ingredients": [{ "item": "minecraft:barrier" }],
        "result": { "item": "minecraft:barrier", "count": 1 }
    }), CRLF);
};

// TODO: add groups, such as `wooden_slab`, etc.
let templateRecipeSingle = (options, outCount = 1, pattern = null)=>{
    let tags = [];
    for (let i=0;i<options.count;i++) {
        tags.push(`
        ${JSON.stringify(options.input)}`);
    };
    return crlf(pattern ? `{
    "type": "crafting_shaped",
    "pattern": [${pattern}],
    "key": {
        "#": ${JSON.stringify(options.input)}
    },
    "result": {
        "item": "${options.result["item"]}",
        "count": ${outCount}
    },
    "group": "${options.group}"
}` : `{
    "type": "crafting_shapeless",
    "ingredients": [${tags.join(",")}
    ],
    "result": {
        "item": "${options.result["item"]}",
        "count": ${outCount}
    },
    "group": "${options.group}"
}`, CRLF);
};

let PP3x1Pattern = `"###"`;
let stairs3x3Pattern = `"#  ", "## ", "###"`;
let stairs2x2Pattern = `"# ", "##"`;
let slabs2x1Pattern = `"##"`;



let advancementTemplate = (options)=>{
    let criterias = [];
    let criteraNames = [];
    
    for (let key in options.criterias) {
        criteraNames.push(key);
        criterias.push(options.criterias[key]);
    };
    
    let criteriaStrings = [];
    for (let i=0;i<criterias.length;i++) {
        criteriaStrings.push(`
        "${criteraNames[i]}": ${JSON.stringify(criterias[i])}`);
    };
    
    return crlf(`{
    "parent": "minecraft:recipes/root",
    "criteria": {${criteriaStrings.join(",")},
        "has_the_recipe": {
            "trigger": "minecraft:recipe_unlocked",
            "conditions": {
                "recipe": "${options.recipeAddress}"
            }
        }
    },
    "requirements": [
        [${criteraNames.map((n)=>{return `"${n}"`;}).join(",")},"has_the_recipe"]
    ],
    "rewards": { "recipes": ["${options.recipeAddress}"] }
}`, CRLF);
};

let names = ["banner", "bed", "candle", "concrete", "carpet", "concrete_powder", "glass", "glass_pane", "glazed_terracotta", "terracotta", "wool"];
let colors = ["black", "blue", "brown", "cyan", "gray", "green", "light_blue", "light_gray", "lime", "magenta", "orange", "pink", "purple", "red", "white", "yellow", "default"];

let templateColors = (options)=>{
    let tags = [];

    let rejectionCode = options.color != "default" ? `/not_${options.color}` : ``;

    for (let i=0;i<options.count;i++) {
        tags.push(`
        {"tag": "better_dyeables:${options.name}${rejectionCode}"}`);
    }
    
    let mcName = 
        (options.name == "glass" || options.name == "glass_pane") && 
         options.color != "default" ? 
            `${options.color}_stained_${options.name}` : 
              (options.color != "default" ? `${options.color}_${options.name}` : `${options.name}`);

    return crlf(`{
    "type": "crafting_shapeless",
    "ingredients": [
        {"tag": "better_dyeables:dye/${options.color}"},${tags.join(",")}
    ],
    "result": {
        "item": "minecraft:${mcName}",
        "count": ${options.count}
    },
    "group": "${options.color}_${options.name}"
}`, CRLF);
};

// TODO: shulker boxes support
if (usedModules.indexOf("co-extra-better-dyeables") != -1) {
    let rootDirAdv = `${srcDir}/co-extra-better-dyeables/data/better_dyeables/advancements/recipes/better_dyeables`;
    let rootDir = `${srcDir}/co-extra-better-dyeables/data/better_dyeables/recipes`;
    let rootDirMc = `${srcDir}/co-extra-better-dyeables/data/minecraft/recipes`;

    fs.rmSync(`${rootDirAdv}`, { recursive: true, force: true });
    fs.rmSync(`${rootDir}`, { recursive: true, force: true });

    names.forEach((name)=>{
        colors.forEach((color)=>{
            let rejectionCode = color != "default" ? `/not_${color}` : ``;
            let mcName = 
                (name == "glass" || name == "glass_pane") && 
                color != "default" ? 
                `${color}_stained_${name}` : 
                    (color != "default" ? `${color}_${name}` : `${name}`);
            
            // kill vanilla dyeing!
            if (color != "default" && name != "glazed_terracotta" && name != "concrete_powder" && name != "concrete" && name != "banner") {
                fs.mkdirSync(    `${rootDirMc}`, { recursive: true });
                
                if (name == "bed") {
                    if (color != "white") { fs.writeFileSync(`${rootDirMc}/${mcName}_from_white_${name}.json`, templateStub({}), 'utf8'); };
                } else
                if (name == "carpet") {
                    if (color != "white") { fs.writeFileSync(`${rootDirMc}/${mcName}_from_white_${name}.json`, templateStub({}), 'utf8'); };
                } else
                if (name == "glass_pane") {
                    if (color != "default") { fs.writeFileSync(`${rootDirMc}/${mcName}_from_${name}.json`, templateStub({}), 'utf8'); };
                } else
                if (name == "glass") {
                    if (color != "default") { fs.writeFileSync(`${rootDirMc}/${mcName}_from_${name}.json`, templateStub({}), 'utf8'); };
                } else
                {
                    fs.writeFileSync(`${rootDirMc}/${mcName}.json`, templateStub({}), 'utf8');
                }
            };
            
            if (!(color == "default" && (name == "bed" || name == "wool" || name == "carpet" || name == "concrete_powder" || name == "concrete" || name == "banner" || name == "glazed_terracotta"))) {
                let maxCount = name != "bed" ? 8 : 1;
                for (let i=1;i<=maxCount;i++) {
                    let criterias = {};
                    criterias["has_dyeable"] = { "trigger": "minecraft:inventory_changed", "conditions": { "items": [ {"tag": `better_dyeables:dye/${color}`} ] } };
                    criterias["has_dye"] = { "trigger": "minecraft:inventory_changed", "conditions": { "items": [ {"tag": `better_dyeables:${name}${rejectionCode}`} ] } };
                    criterias["has_result"] = { "trigger": "minecraft:inventory_changed", "conditions": { "items": [ {"item": `minecraft:${mcName}`} ] } };

                    fs.mkdirSync(`${rootDirAdv}/${name}/${color}`, { recursive: true });
                    fs.writeFileSync(`${rootDirAdv}/${name}/${color}/${i}.json`, advancementTemplate({
                        criterias, 
                        recipeAddress: `better_dyeables:${name}/${color}/${i}`
                    }), 'utf8');

                    fs.mkdirSync(`${rootDir}/${name}/${color}`, { recursive: true });
                    fs.writeFileSync(`${rootDir}/${name}/${color}/${i}.json`, templateColors({
                        color, name, count: i
                    }), 'utf8');
                }
            }
        });
    });
};



//
let namings = {
    "block": "blocks",
    "slab": "slabs",
    "stairs": "stairs",
    "pressure_plate": "pressure_plates",
    "stair": "stairs",
};

//
let generateModuleRecipes = (options)=>{
    let rootDirAdv = `${options.datapack}/data/crafting/advancements/recipes/crafting`;
    let rootDir = `${options.datapack}/data/crafting/recipes`;

    Array.from(Object.entries(options.blocks)).forEach(([key, obj])=>{
        let outsource = options.type != "block" ? obj[options.type] : obj[options.from];
        if (outsource && (disallowedData[usedMCVersion].indexOf(obj.mc_version) == -1 || !obj.mc_version) && !outsource.extra && (options.single ? ((options.type != "block" ? obj[options.type] : obj)["single"] || allowVanillaRecipeConflicts) : true) && !obj.extra) {
            let criterias = {};
            criterias[`has_${options.type}`] = { "trigger": "minecraft:inventory_changed", "conditions": (options.type != "block" ? obj : obj[options.from])["source"] };
            criterias["has_result"]          = { "trigger": "minecraft:inventory_changed", "conditions": (options.type != "block" ? obj[options.type] : obj)["source"] };

            //
            let filename = (options.type != "block" ? obj[options.type] : obj)["filename"];
            let unversion = `${namings[options.type]}/${options.subdir||""}`;
            let directory = `${obj.mc_version}/${unversion}`;

            // advancements
            fs.mkdirSync(    `${rootDirAdv}/${directory}`, { recursive: true });
            fs.writeFileSync(`${rootDirAdv}/${directory}/${filename}.json`, advancementTemplate({ 
                criterias, 
                recipeAddress: `crafting:${mergeVersions ? unversion : directory}/${filename}` 
            }), 'utf8');
            
            // crafting
            fs.mkdirSync(    `${rootDir}/${directory}`, { recursive: true });
            fs.writeFileSync(`${rootDir}/${directory}/${filename}.json`, options.handler(obj, options), 'utf8');
        };
    });
};

//
let generateVanillaStub = (options)=>{
    let rootDirMc = `${options.datapack}/data/minecraft/recipes`;

    Array.from(Object.entries(options.blocks)).forEach(([key, obj])=>{
        if ((disallowedData[usedMCVersion].indexOf(obj.mc_version) == -1 || !obj.mc_version) && (options.type != "block" ? obj[options.type] : obj[options.from])) {
            fs.mkdirSync(    `${rootDirMc}`, { recursive: true });
            fs.writeFileSync(`${rootDirMc}/${(options.type != "block" ? obj[options.type] : obj)["filename"]}.json`, templateStub({}), 'utf8');
        };
    });
};

if (usedModules.indexOf("co-disable-default-slabs") != -1) {
    generateVanillaStub({
        datapack: `${srcDir}/co-disable-default-slabs`,
        blocks,
        type: "slab",
        from: "block"
    });
};

//
if (usedModules.indexOf("co-disable-default-stairs") != -1) {
    generateVanillaStub({
        datapack: `${srcDir}/co-disable-default-stairs`,
        blocks,
        type: "stairs",
        from: "block"
    });
};

//
if (usedModules.indexOf("co-disable-default-pressure-plates") != -1) {
    generateVanillaStub({
        datapack: `${srcDir}/co-disable-default-pressure-plates`,
        blocks,
        type: "pressure_plate",
        from: "block"
    });
};

//
if (usedModules.indexOf("co-3x1-pressure-plates") != -1) {
    let datapack = `${srcDir}/co-3x1-pressure-plates`;
    fs.rmSync(`${datapack}/data/crafting/advancements/recipes/crafting`, { recursive: true, force: true });
    fs.rmSync(`${datapack}/data/crafting/recipes`, { recursive: true, force: true });

    generateModuleRecipes({
        datapack,
        blocks,
        type: "pressure_plate",
        from: "block",
        subdir: "",
        handler: (obj, options)=>{
            return templateRecipeSingle({
                count: 3,
                input:  (options.type != "block" ? obj : obj[options.from])["source"],
                result: (options.type != "block" ? obj[options.type] : obj)["source"],
                group: obj.group ? obj.group : namings[options.type]
            }, 1, PP3x1Pattern);
        }
    });
};

//
if (usedModules.indexOf("co-2x1-slabs") != -1) {
    /*
    generateVanillaStub({
        datapack: `${srcDir}/co-2x1-slabs`,
        blocks,
        type: "pressure_plate",
        from: "block"
    });*/

    let datapack = `${srcDir}/co-2x1-slabs`;
    fs.rmSync(`${datapack}/data/crafting/advancements/recipes/crafting`, { recursive: true, force: true });
    fs.rmSync(`${datapack}/data/crafting/recipes`, { recursive: true, force: true });

    generateModuleRecipes({
        datapack,
        blocks,
        type: "slab",
        from: "block",
        subdir: "blocks2x1",
        handler: (obj, options)=>{
            return templateRecipeSingle({
                count: 2,
                input:  (options.type != "block" ? obj : obj[options.from])["source"],
                result: (options.type != "block" ? obj[options.type] : obj)["source"],
                group: obj.group ? obj.group : namings[options.type]
            }, 4, slabs2x1Pattern);
        }
    });

};

// TODO: multiple configurations
if (usedModules.indexOf("co-1x1-slabs") != -1) {
    let datapack = `${srcDir}/co-1x1-slabs`;
    fs.rmSync(`${datapack}/data/crafting/advancements/recipes/crafting`, { recursive: true, force: true });
    fs.rmSync(`${datapack}/data/crafting/recipes`, { recursive: true, force: true });

    generateModuleRecipes({
        datapack,
        blocks,
        type: "slab",
        from: "block",
        subdir: "blocks1x1",
        single: true,
        handler: (obj, options)=>{
            return templateRecipeSingle({
                count: 1,
                input:  (options.type != "block" ? obj : obj[options.from])["source"],
                result: (options.type != "block" ? obj[options.type] : obj)["source"],
                group: obj.group ? obj.group : namings[options.type]
            }, 2);
        }
    });
};

// TODO: multiple configurations
if (usedModules.indexOf("co-2x2-stairs") != -1) {
    let datapack = `${srcDir}/co-2x2-stairs`;
    fs.rmSync(`${datapack}/data/crafting/advancements/recipes/crafting`, { recursive: true, force: true });
    fs.rmSync(`${datapack}/data/crafting/recipes`, { recursive: true, force: true });

    generateModuleRecipes({
        datapack,
        blocks,
        type: "stairs",
        from: "block",
        subdir: "blocks2x2",
        handler: (obj, options)=>{
            return templateRecipeSingle({
                count: 1,
                input:  (options.type != "block" ? obj : obj[options.from])["source"],
                result: (options.type != "block" ? obj[options.type] : obj)["source"],
                group: obj.group ? obj.group : namings[options.type]
            }, 4, stairs2x2Pattern);
        }
    });
};

// TODO: multiple configurations
if (usedModules.indexOf("co-3x3-more-stairs") != -1) {
    let datapack = `${srcDir}/co-3x3-more-stairs`;
    fs.rmSync(`${datapack}/data/crafting/advancements/recipes/crafting`, { recursive: true, force: true });
    fs.rmSync(`${datapack}/data/crafting/recipes`, { recursive: true, force: true });

    generateModuleRecipes({
        datapack,
        blocks,
        type: "stairs",
        from: "block",
        subdir: "blocks3x3",
        handler: (obj, options)=>{
            return templateRecipeSingle({
                count: 1,
                input:  (options.type != "block" ? obj : obj[options.from])["source"],
                result: (options.type != "block" ? obj[options.type] : obj)["source"],
                group: obj.group ? obj.group : namings[options.type]
            }, 8, stairs3x3Pattern);
        }
    });
};

// TODO: multiple configurations support
if (usedModules.indexOf("vt-slabs-stairs-to-block") != -1) {
    let datapack = `${srcDir}/vt-slabs-stairs-to-block`;
    fs.rmSync(`${datapack}/data/crafting/advancements/recipes/crafting`, { recursive: true, force: true });
    fs.rmSync(`${datapack}/data/crafting/recipes`, { recursive: true, force: true });

    generateModuleRecipes({
        datapack,
        blocks,
        type: "block",
        from: "stairs",
        subdir: "stairs4x",
        handler: (obj, options)=>{
            return templateRecipeSingle({
                count: 4,
                input:  (options.type != "block" ? obj : obj[options.from])["source"],
                result: (options.type != "block" ? obj[options.type] : obj)["source"],
                group: obj.group ? obj.group : namings[options.type]
            }, 3);
        }
    });

    generateModuleRecipes({
        datapack,
        blocks,
        type: "block",
        from: "slab",
        subdir: allowVanillaRecipeConflicts ? "slabs2x" : "slabs2x1",
        handler: (obj, options)=>{
            return templateRecipeSingle({
                count: 2,
                input:  (options.type != "block" ? obj : obj[options.from])["source"],
                result: (options.type != "block" ? obj[options.type] : obj)["source"],
                group: obj.group ? obj.group : namings[options.type]
            }, 1, allowVanillaRecipeConflicts ? null : slabs2x1Pattern);
        }
    });

    generateModuleRecipes({
        datapack,
        blocks,
        type: "block",
        from: "slab",
        subdir: "slabs4x",
        handler: (obj, options)=>{
            return templateRecipeSingle({
                count: 4,
                input:  (options.type != "block" ? obj : obj[options.from])["source"],
                result: (options.type != "block" ? obj[options.type] : obj)["source"],
                group: obj.group ? obj.group : namings[options.type]
            }, 2);
        }
    });
};

//
fs.rmSync(`${dstDir}/data`, { recursive: true, force: true });
fs.mkdirSync(`${dstDir}/data`, { recursive: true });
fs.writeFileSync(`${dstDir}/pack.mcmeta`, `{"pack":{"pack_format":${dataVersion[usedMCVersion]},"description":"Minecraft crafting recipes overhaul compiled for ${mcVersionString[usedMCVersion]}"}}`, 'utf8');

//
let mergeVersionsFn = (directory, experimentalDatapacks = false)=>{
    let outputs = {};
    let files = fs.existsSync(`${directory}`) ? fs.readdirSync(`${directory}`) : [];
    
    files.forEach((filename)=>{
        if (mcVersions.indexOf(filename) != -1) {
            let versioned = fs.readdirSync(`${directory}/${filename}`);
            versioned.forEach((fn)=>{
                outputs[`${directory}/${fn}`] = outputs[`${directory}/${fn}`] || [];
                outputs[`${directory}/${fn}`].push(`${directory}/${filename}`);
            });
        };
    });

    for (let key in outputs) {
        mergeDirectories(outputs[key], key, { overwrite: true });
    };

    files.forEach((filename)=>{
        if (mcVersions.indexOf(filename) != -1 && mergeVersions) {
            fs.rmSync(`${directory}/${filename}`, { recursive: true, force: true });
        };
    });
};

let removeDisallowedFn = (directory)=>{
    let files = fs.existsSync(`${directory}`) ? fs.readdirSync(`${directory}`) : [];
    files.forEach((filename)=>{
        if (disallowedData[usedMCVersion].indexOf(filename) != -1) {
            fs.rmSync(`${directory}/${filename}`, { recursive: true, force: true });
        }
    });
};

//
if (experimentalDatapacks) {
    usedModules.map((M)=>{
        let FM_DIR = `${srcDir}/${M}`;
        let files = fs.readdirSync(`${FM_DIR}`);
        let names = fs.readdirSync(`${FM_DIR}/data`);
        names.filter((s)=>s.indexOf(".")<0).map((F)=>{
            let DP_DIR = `${dstDir}/data/${dataIdentifier}/datapacks/${M.replaceAll("-","_")}`;
            fs.mkdirSync(`${DP_DIR}`, { recursive: true });
            
            //
            files.filter((s)=>s.indexOf(".")>=0).map((F)=>{
                fs.copyFileSync(`${FM_DIR}/${F}`, `${DP_DIR}/${F}`);
                //fs.writeFileSync(`${DP_DIR}/${F}`, fs.readFileSync(`${FM_DIR}/${F}`));
            });
            
            //efs.copyFileSync(`${srcDir}/${M}`, `${DP_DIR}`);
            mergeDirectories(names.map((N)=>`${FM_DIR}/data/${N}`), `${DP_DIR}/data/${F}`, { overwrite: true });

            // remove disallowed version data from "crafting"
            {
                removeDisallowedFn(`${DP_DIR}/data/${F}`);
                removeDisallowedFn(`${DP_DIR}/data/${F}/crafting/recipes`);
                removeDisallowedFn(`${DP_DIR}/data/${F}/advancements/recipes/crafting`);
            };

            //
            if (mergeVersions) {
                mergeVersionsFn(`${DP_DIR}/data/${F}`);
                mergeVersionsFn(`${DP_DIR}/data/${F}/crafting/recipes`);
                mergeVersionsFn(`${DP_DIR}/data/${F}/advancements/recipes/crafting`);
            };
        });
        
        //
        removeDisallowedFn(`${FM_DIR}/data`);
        
        //
        if (mergeVersions) {
            mergeVersionsFn(`${FM_DIR}/data`, experimentalDatapacks);
        }
    });
} else {
    //
    let DP_DIR = `${dstDir}/data`;
    mergeDirectories(usedModules.map((M)=>{ return `${srcDir}/${M}/data`; }), `${DP_DIR}`, { overwrite: true });
    
    // remove disallowed version data from "crafting"
    {
        removeDisallowedFn(`${DP_DIR}/crafting/recipes`);
        removeDisallowedFn(`${DP_DIR}/crafting/advancements/recipes/crafting`);
    };

    //
    if (mergeVersions) {
        mergeVersionsFn(`${DP_DIR}/crafting/recipes`);
        mergeVersionsFn(`${DP_DIR}/crafting/advancements/recipes/crafting`);
    };
}

// copy required files
{
    let files = fs.readdirSync("./required");
    files.forEach((filename)=>{
        fse.copySync(`./required/${filename}`, `${dstDir}/${filename}`);
    });
}

//
{
    fs.mkdirSync(`../src/main/java/net/hydra2s/crop/generated`, { recursive: true });
    fs.writeFileSync(`../src/main/java/net/hydra2s/crop/generated/Modules.java`, `package net.hydra2s.crop.generated;
    
public class Modules {
    public static String[] moduleNames = new String[]{ ${usedModules.map((s)=>`"${s.replaceAll("-","_")}"`).join(",")} };
}
    `, 'utf8');
}
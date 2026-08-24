#target photoshop

/*
 * Creates the editable LingBuilder component-tutorial cover templates.
 * All user-facing Chinese strings use Unicode escapes so Photoshop CS6 can
 * execute this file consistently regardless of the local script encoding.
 */

app.displayDialogs = DialogModes.NO;
app.preferences.rulerUnits = Units.PIXELS;

var ROOT = "C:/Users/Administrator/Downloads/c++-\u6c49\u5316\u96c6\u6210\u5f00\u53d1\u73af\u5883(lingbuilder)";
var OUTPUT_FOLDER = ROOT + "/\u5ba3\u4f20\u7d20\u6750/LingBuilder\u7ec4\u4ef6\u6559\u7a0b\u5c01\u9762\u6a21\u677f";
var WORKBENCH_SOURCE = ROOT + "/videos/lingbuilder-douyin-promo/capture/assets/lingbuilder-workbench.png";
var ICON_SOURCE = ROOT + "/image/lingbuilder-icon-master-v2.png";
var FONT_NAME = "MicrosoftYaHei";

ensureFolder(OUTPUT_FOLDER);
ensureFolder(OUTPUT_FOLDER + "/assets");
copyAsset(WORKBENCH_SOURCE, OUTPUT_FOLDER + "/assets/lingbuilder-workbench.png");
copyAsset(ICON_SOURCE, OUTPUT_FOLDER + "/assets/lingbuilder-icon-master-v2.png");

function ensureFolder(path) {
    var folder = new Folder(path);
    if (!folder.exists && !folder.create()) {
        throw new Error("Unable to create folder: " + path);
    }
}

function copyAsset(sourcePath, destinationPath) {
    var source = new File(sourcePath);
    var destination = new File(destinationPath);
    if (!source.exists) {
        throw new Error("Missing source asset: " + sourcePath);
    }
    if (!destination.exists) {
        source.copy(destination);
    }
}

function rgb(r, g, b) {
    var color = new SolidColor();
    color.rgb.red = r;
    color.rgb.green = g;
    color.rgb.blue = b;
    return color;
}

function px(value) {
    return UnitValue(value, "px");
}

function newGroup(doc, name) {
    var group = doc.layerSets.add();
    group.name = name;
    return group;
}

function addFullFill(doc, group, name, color, opacity) {
    var layer = doc.artLayers.add();
    layer.name = name;
    doc.selection.selectAll();
    doc.selection.fill(color);
    doc.selection.deselect();
    layer.opacity = opacity;
    if (group) {
        layer.move(group, ElementPlacement.INSIDE);
    }
    return layer;
}

function addRect(doc, group, name, x, y, width, height, color, opacity) {
    var layer = doc.artLayers.add();
    layer.name = name;
    doc.selection.select([[x, y], [x + width, y], [x + width, y + height], [x, y + height]]);
    doc.selection.fill(color);
    doc.selection.deselect();
    layer.opacity = opacity;
    if (group) {
        layer.move(group, ElementPlacement.INSIDE);
    }
    return layer;
}

function addText(doc, group, name, contents, x, y, size, color, opacity) {
    var layer = doc.artLayers.add();
    layer.kind = LayerKind.TEXT;
    layer.name = name;
    var item = layer.textItem;
    item.contents = contents;
    item.position = [px(x), px(y)];
    item.size = px(size);
    try {
        item.font = FONT_NAME;
    } catch (error) {
        item.font = "ArialMT";
    }
    item.color = color;
    item.justification = Justification.LEFT;
    layer.opacity = opacity;
    if (group) {
        layer.move(group, ElementPlacement.INSIDE);
    }
    return layer;
}

function placeImage(doc, group, sourcePath, name, x, y, maximumWidth, maximumHeight, opacity) {
    var source = new File(sourcePath);
    if (!source.exists) {
        throw new Error("Missing source asset: " + sourcePath);
    }

    var sourceDoc = app.open(source);
    var layer = sourceDoc.activeLayer.duplicate(doc, ElementPlacement.PLACEATBEGINNING);
    sourceDoc.close(SaveOptions.DONOTSAVECHANGES);
    app.activeDocument = doc;

    layer.name = name;
    var bounds = layer.bounds;
    var currentWidth = bounds[2].as("px") - bounds[0].as("px");
    var currentHeight = bounds[3].as("px") - bounds[1].as("px");
    var scale = Math.min(maximumWidth / currentWidth, maximumHeight / currentHeight) * 100;
    layer.resize(scale, scale, AnchorPosition.MIDDLECENTER);

    bounds = layer.bounds;
    layer.translate(px(x - bounds[0].as("px")), px(y - bounds[1].as("px")));
    layer.opacity = opacity;
    if (group) {
        layer.move(group, ElementPlacement.INSIDE);
    }
    return layer;
}

function addGrid(doc, group, width, height, startX, startY, step, verticalCount, horizontalCount) {
    var gridColor = rgb(99, 211, 255);
    var index;
    for (index = 0; index < verticalCount; index++) {
        addRect(doc, group, "\u7f51\u683c-\u7ad6\u7ebf-" + (index + 1), startX + index * step, startY, 1, height, gridColor, 11);
    }
    for (index = 0; index < horizontalCount; index++) {
        addRect(doc, group, "\u7f51\u683c-\u6a2a\u7ebf-" + (index + 1), startX, startY + index * step, width, 1, gridColor, 11);
    }
}

function saveTemplate(doc, baseName) {
    var psdFile = new File(OUTPUT_FOLDER + "/" + baseName + ".psd");
    var psdOptions = new PhotoshopSaveOptions();
    psdOptions.layers = true;
    psdOptions.embedColorProfile = true;
    doc.saveAs(psdFile, psdOptions, false, Extension.LOWERCASE);

    var previewFile = new File(OUTPUT_FOLDER + "/" + baseName + "-\u9884\u89c8.png");
    var pngOptions = new PNGSaveOptions();
    doc.saveAs(previewFile, pngOptions, true, Extension.LOWERCASE);
    doc.close(SaveOptions.DONOTSAVECHANGES);
}

function makeLandscape() {
    var doc = app.documents.add(px(1920), px(1080), 72, "LingBuilder Component Tutorial Landscape", NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
    var background = newGroup(doc, "01 \u80cc\u666f");
    var visual = newGroup(doc, "02 \u89c6\u89c9\u88c5\u9970\u4e0e\u622a\u56fe");
    var brand = newGroup(doc, "03 \u54c1\u724c");
    var copy = newGroup(doc, "04 \u6587\u6848\uff08\u53cc\u51fb\u6587\u5b57\u4fee\u6539\uff09");

    addFullFill(doc, background, "\u70ad\u9ed1\u5e95\u8272", rgb(9, 16, 26), 100);
    addFullFill(doc, background, "\u4e0a\u90e8\u84dd\u9ed1\u6c1b\u56f4", rgb(11, 29, 48), 52);
    addRect(doc, background, "\u5de6\u4fa7\u6587\u6848\u906e\u7f69", 0, 0, 1010, 1080, rgb(5, 12, 20), 62);
    background.move(doc, ElementPlacement.PLACEATEND);

    addGrid(doc, visual, 750, 700, 1060, 150, 70, 12, 10);
    addRect(doc, visual, "\u9752\u8272\u4e3b\u89c6\u89c9\u7ebf", 90, 194, 230, 7, rgb(28, 229, 222), 100);
    addRect(doc, visual, "\u7d2b\u8272\u7ec6\u8282\u70b9", 1640, 120, 130, 5, rgb(143, 102, 255), 90);
    addRect(doc, visual, "\u7a97\u53e3\u5361\u7247\u5e95\u677f", 1007, 217, 840, 543, rgb(5, 14, 24), 100);
    addRect(doc, visual, "\u7a97\u53e3\u5361\u7247\u8fb9\u6846-\u4e0a", 1007, 217, 840, 3, rgb(46, 217, 255), 90);
    addRect(doc, visual, "\u7a97\u53e3\u5361\u7247\u8fb9\u6846-\u5de6", 1007, 217, 3, 543, rgb(46, 217, 255), 70);
    placeImage(doc, visual, WORKBENCH_SOURCE, "\u5de5\u4f5c\u53f0\u622a\u56fe\uff08\u53ef\u66ff\u6362\uff09", 1025, 247, 804, 470, 93);
    addRect(doc, visual, "\u622a\u56fe\u84dd\u8272\u906e\u7f69", 1025, 247, 804, 470, rgb(13, 67, 105), 15);
    addRect(doc, visual, "\u622a\u56fe\u5e95\u90e8\u72b6\u6001\u680f", 1025, 718, 804, 28, rgb(12, 38, 58), 92);
    addRect(doc, visual, "\u622a\u56fe\u5e95\u90e8\u72b6\u6001\u70b9-1", 1050, 728, 68, 5, rgb(31, 235, 222), 100);
    addRect(doc, visual, "\u622a\u56fe\u5e95\u90e8\u72b6\u6001\u70b9-2", 1130, 728, 36, 5, rgb(118, 142, 162), 80);
    addRect(doc, visual, "\u7a97\u53e3\u6807\u7b7e", 1025, 173, 182, 31, rgb(19, 52, 74), 96);
    addText(doc, visual, "\u7a97\u53e3\u6807\u7b7e\u6587\u5b57", "LINGBUILDER / UI", 1042, 197, 16, rgb(129, 223, 255), 100);

    placeImage(doc, brand, ICON_SOURCE, "LingBuilder \u56fe\u6807\uff08\u53ef\u66ff\u6362\uff09", 93, 80, 62, 62, 100);
    addText(doc, brand, "\u54c1\u724c\u540d", "LingBuilder IDE", 171, 121, 31, rgb(244, 251, 255), 100);
    addText(doc, brand, "\u54c1\u724c\u8bf4\u660e", "\u4e2d\u6587\u96c6\u6210\u5f00\u53d1\u73af\u5883", 174, 148, 16, rgb(126, 166, 188), 100);

    addRect(doc, copy, "\u7cfb\u5217\u6807\u7b7e\u5e95\u8272", 92, 253, 148, 43, rgb(20, 82, 98), 100);
    addText(doc, copy, "\u7cfb\u5217\u6807\u7b7e", "\u7ec4\u4ef6\u6559\u7a0b", 113, 282, 22, rgb(67, 247, 232), 100);
    addText(doc, copy, "\u4e3b\u6807\u9898\uff08\u53ef\u7f16\u8f91\uff09", "[\u7ec4\u4ef6\u540d\u79f0]", 90, 455, 100, rgb(246, 251, 255), 100);
    addText(doc, copy, "\u526f\u6807\u9898\uff08\u53ef\u7f16\u8f91\uff09", "\u4ece\u62d6\u62fd\u3001\u5c5e\u6027\u5230\u4e8b\u4ef6\u7ed1\u5b9a", 96, 532, 33, rgb(164, 202, 223), 100);
    addRect(doc, copy, "\u96c6\u6570\u6807\u7b7e\u5e95\u8272", 92, 624, 205, 59, rgb(29, 225, 211), 100);
    addText(doc, copy, "\u96c6\u6570\uff08\u53ef\u7f16\u8f91\uff09", "\u7b2c 01 \u96c6", 117, 664, 30, rgb(6, 20, 29), 100);
    addText(doc, copy, "\u8bfe\u7a0b\u8bf4\u660e\uff08\u53ef\u7f16\u8f91\uff09", "\u4e00\u96c6\u5b66\u4f1a\u4e00\u4e2a\u63a7\u4ef6", 92, 755, 25, rgb(99, 157, 184), 100);
    addText(doc, copy, "\u53f3\u4e0b\u89d2\u7cfb\u5217\u6807\u8bc6", "COMPONENT SERIES", 1402, 940, 23, rgb(139, 204, 232), 88);
    addRect(doc, copy, "\u53f3\u4e0b\u89d2\u70b9\u7f00", 1358, 925, 26, 26, rgb(143, 102, 255), 100);

    saveTemplate(doc, "LingBuilder\u7ec4\u4ef6\u6559\u7a0b\u5c01\u9762-\u6a2a\u7248");
}

function makePortrait() {
    var doc = app.documents.add(px(1080), px(1920), 72, "LingBuilder Component Tutorial Portrait", NewDocumentMode.RGB, DocumentFill.TRANSPARENT);
    var background = newGroup(doc, "01 \u80cc\u666f");
    var visual = newGroup(doc, "02 \u89c6\u89c9\u88c5\u9970\u4e0e\u622a\u56fe");
    var brand = newGroup(doc, "03 \u54c1\u724c");
    var copy = newGroup(doc, "04 \u6587\u6848\uff08\u53cc\u51fb\u6587\u5b57\u4fee\u6539\uff09");

    addFullFill(doc, background, "\u70ad\u9ed1\u5e95\u8272", rgb(8, 15, 25), 100);
    addFullFill(doc, background, "\u4e0a\u90e8\u84dd\u9ed1\u6c1b\u56f4", rgb(10, 30, 51), 58);
    addRect(doc, background, "\u4e0a\u534a\u90e8\u6587\u6848\u906e\u7f69", 0, 0, 1080, 980, rgb(5, 12, 20), 58);
    background.move(doc, ElementPlacement.PLACEATEND);

    addGrid(doc, visual, 870, 610, 110, 1010, 72, 12, 9);
    addRect(doc, visual, "\u9876\u90e8\u9752\u8272\u4e3b\u89c6\u89c9\u7ebf", 84, 218, 230, 7, rgb(29, 232, 220), 100);
    addRect(doc, visual, "\u9876\u90e8\u7d2b\u8272\u7ec6\u8282\u70b9", 810, 214, 130, 5, rgb(143, 102, 255), 90);
    addRect(doc, visual, "\u7a97\u53e3\u5361\u7247\u5e95\u677f", 74, 1094, 932, 611, rgb(5, 14, 24), 100);
    addRect(doc, visual, "\u7a97\u53e3\u5361\u7247\u8fb9\u6846-\u4e0a", 74, 1094, 932, 3, rgb(46, 217, 255), 90);
    addRect(doc, visual, "\u7a97\u53e3\u5361\u7247\u8fb9\u6846-\u5de6", 74, 1094, 3, 611, rgb(46, 217, 255), 70);
    placeImage(doc, visual, WORKBENCH_SOURCE, "\u5de5\u4f5c\u53f0\u622a\u56fe\uff08\u53ef\u66ff\u6362\uff09", 91, 1142, 898, 520, 93);
    addRect(doc, visual, "\u622a\u56fe\u84dd\u8272\u906e\u7f69", 91, 1142, 898, 520, rgb(13, 67, 105), 15);
    addRect(doc, visual, "\u622a\u56fe\u5e95\u90e8\u72b6\u6001\u680f", 91, 1665, 898, 29, rgb(12, 38, 58), 92);
    addRect(doc, visual, "\u622a\u56fe\u5e95\u90e8\u72b6\u6001\u70b9-1", 118, 1675, 83, 5, rgb(31, 235, 222), 100);
    addRect(doc, visual, "\u622a\u56fe\u5e95\u90e8\u72b6\u6001\u70b9-2", 218, 1675, 41, 5, rgb(118, 142, 162), 80);

    placeImage(doc, brand, ICON_SOURCE, "LingBuilder \u56fe\u6807\uff08\u53ef\u66ff\u6362\uff09", 82, 85, 62, 62, 100);
    addText(doc, brand, "\u54c1\u724c\u540d", "LingBuilder IDE", 160, 126, 30, rgb(244, 251, 255), 100);
    addText(doc, brand, "\u54c1\u724c\u8bf4\u660e", "\u4e2d\u6587\u96c6\u6210\u5f00\u53d1\u73af\u5883", 162, 153, 16, rgb(126, 166, 188), 100);

    addRect(doc, copy, "\u7cfb\u5217\u6807\u7b7e\u5e95\u8272", 84, 279, 159, 45, rgb(20, 82, 98), 100);
    addText(doc, copy, "\u7cfb\u5217\u6807\u7b7e", "\u7ec4\u4ef6\u6559\u7a0b", 105, 310, 23, rgb(67, 247, 232), 100);
    addText(doc, copy, "\u4e3b\u6807\u9898\uff08\u53ef\u7f16\u8f91\uff09", "[\u7ec4\u4ef6\u540d\u79f0]", 82, 530, 91, rgb(246, 251, 255), 100);
    addText(doc, copy, "\u526f\u6807\u9898\uff08\u53ef\u7f16\u8f91\uff09", "\u4ece\u62d6\u62fd\u3001\u5c5e\u6027\u5230\u4e8b\u4ef6\u7ed1\u5b9a", 87, 610, 30, rgb(164, 202, 223), 100);
    addRect(doc, copy, "\u96c6\u6570\u6807\u7b7e\u5e95\u8272", 82, 728, 190, 57, rgb(29, 225, 211), 100);
    addText(doc, copy, "\u96c6\u6570\uff08\u53ef\u7f16\u8f91\uff09", "\u7b2c 01 \u96c6", 106, 767, 29, rgb(6, 20, 29), 100);
    addText(doc, copy, "\u8bfe\u7a0b\u8bf4\u660e\uff08\u53ef\u7f16\u8f91\uff09", "\u62d6\u62fd  \u00b7  \u5c5e\u6027  \u00b7  \u4e8b\u4ef6", 84, 878, 27, rgb(109, 167, 193), 100);
    addText(doc, copy, "\u5e95\u90e8\u7cfb\u5217\u6807\u8bc6", "COMPONENT SERIES", 323, 1815, 23, rgb(139, 204, 232), 88);
    addRect(doc, copy, "\u5e95\u90e8\u70b9\u7f00", 280, 1798, 26, 26, rgb(143, 102, 255), 100);

    saveTemplate(doc, "LingBuilder\u7ec4\u4ef6\u6559\u7a0b\u5c01\u9762-\u7ad6\u7248");
}

makeLandscape();
makePortrait();
app.displayDialogs = DialogModes.ALL;

/**
 * Smoothio ExtendScript Host – After Effects 2023+
 */

// ─── Helpers ─────────────────────────────────────────────────────────────────

function ok() { return JSON.stringify({ ok: true }); }
function err(msg) { return JSON.stringify({ ok: false, error: String(msg) }); }

function getComp() {
  var comp = app.project.activeItem;
  return (comp instanceof CompItem) ? comp : null;
}

function walkProps(obj, fn) {
  for (var i = 1; i <= obj.numProperties; i++) {
    try {
      var p = obj.property(i);
      if (!p) continue;
      if (p.propertyType === PropertyType.PROPERTY) {
        fn(p);
      } else {
        walkProps(p, fn);
      }
    } catch (e) {}
  }
}

function selKeys(prop) {
  var out = [];
  for (var k = 1; k <= prop.numKeys; k++) {
    if (prop.keySelected(k)) out.push(k);
  }
  return out;
}

function allKeys(prop) {
  var out = [];
  for (var k = 1; k <= prop.numKeys; k++) out.push(k);
  return out;
}

function valueDiff(va, vb) {
  if (typeof va === 'number') return vb - va;
  if (va && va.length) {
    var s = 0;
    for (var i = 0; i < va.length; i++) s += Math.pow(vb[i] - va[i], 2);
    var mag = Math.sqrt(s);
    return (va.length > 0 && vb[0] < va[0]) ? -mag : mag;
  }
  return 1;
}

// lerpValue supports t outside [0,1] for overshoot extrapolation
function lerpValue(vA, vB, t) {
  if (typeof vA === 'number') return vA + (vB - vA) * t;
  var result = [];
  for (var i = 0; i < vA.length; i++) result.push(vA[i] + (vB[i] - vA[i]) * t);
  return result;
}

function findKeyAtTime(prop, t) {
  for (var k = 1; k <= prop.numKeys; k++) {
    if (Math.abs(prop.keyTime(k) - t) < 0.001) return k;
  }
  return -1;
}

// ─── Ease application ────────────────────────────────────────────────────────

// Returns true if any handle Y goes outside [0,1] in segment-local space.
function curveHasOvershoot(handles, midPts) {
  var guiAnchors = [{ x: 0, y: 0 }];
  for (var i = 0; i < midPts.length; i++) guiAnchors.push({ x: midPts[i].x, y: midPts[i].y });
  guiAnchors.push({ x: 1, y: 1 });
  for (var hi = 0; hi < handles.length; hi++) {
    var segA = guiAnchors[hi], segB = guiAnchors[hi + 1];
    var sdy = segB.y - segA.y;
    var loy, liy;
    if (Math.abs(sdy) < 1e-10) {
      loy = handles[hi].out.y;
      liy = handles[hi]['in'].y;
    } else {
      loy = (handles[hi].out.y - segA.y) / sdy;
      liy = (handles[hi]['in'].y - segA.y) / sdy;
    }
    if (loy > 1.001 || loy < -0.001 || liy > 1.001 || liy < -0.001) return true;
  }
  return false;
}

// Build one KeyframeEase pair from segment-local handle coords.
// dv can be negative (overshoot) for non-spatial properties.
function computeEasePair(lox, loy, lix, liy, dv, dt) {
  var outInfl = Math.max(0.1, Math.min(99.9, lox * 100));
  var outSpd;
  if (lox > 0.001) {
    outSpd = (loy / lox) * (dv / dt);
  } else {
    outSpd = (Math.abs(dv) < 1e-10) ? 0 : (dv > 0 ? 9999 : -9999);
  }

  var inInfl = Math.max(0.1, Math.min(99.9, (1 - lix) * 100));
  var inSpd;
  if (lix < 0.999) {
    inSpd = ((1 - liy) / (1 - lix)) * (dv / dt);
  } else {
    inSpd = (Math.abs(dv) < 1e-10) ? 0 : (dv > 0 ? 9999 : -9999);
  }

  return {
    easeOut: new KeyframeEase(outSpd, outInfl),
    easeIn:  new KeyframeEase(inSpd,  inInfl),
  };
}

// Apply ease to one keyframe segment [kA, kB].
// segA, segB: this ease-segment's anchor positions in global [0,1] canvas space.
// Handles are in global space and get transformed to segment-local space here.
// For non-spatial multi-dim properties (e.g. Scale), builds per-dimension ease arrays.
function applySegment(prop, kA, kB, handle, segA, segB) {
  if (!segA) segA = { x: 0, y: 0 };
  if (!segB) segB = { x: 1, y: 1 };

  var dt = prop.keyTime(kB) - prop.keyTime(kA);
  if (dt <= 0) return;

  // Transform global handle coords → segment-local [0,1] space
  var sdx = segB.x - segA.x;
  var sdy = segB.y - segA.y;
  var lox, loy, lix, liy;
  if (Math.abs(sdx) < 1e-10 || Math.abs(sdy) < 1e-10) {
    lox = handle.out.x;   loy = handle.out.y;
    lix = handle['in'].x; liy = handle['in'].y;
  } else {
    lox = (handle.out.x   - segA.x) / sdx;
    loy = (handle.out.y   - segA.y) / sdy;
    lix = (handle['in'].x - segA.x) / sdx;
    liy = (handle['in'].y - segA.y) / sdy;
  }

  // Linear ease: handles lie on the diagonal (loy≈lox, liy≈lix) → use LINEAR interpolation
  if (Math.abs(loy - lox) < 0.02 && Math.abs(liy - lix) < 0.02) {
    try { prop.setInterpolationTypeAtKey(kA, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR); } catch (e) {}
    try { prop.setInterpolationTypeAtKey(kB, KeyframeInterpolationType.LINEAR, KeyframeInterpolationType.LINEAR); } catch (e) {}
    return;
  }

  try { prop.setInterpolationTypeAtKey(kA, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER); } catch (e) {}
  try { prop.setInterpolationTypeAtKey(kB, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER); } catch (e) {}

  var vA = prop.keyValue(kA);
  var vB = prop.keyValue(kB);
  var isMultiDim = (typeof vA === 'object' && vA !== null && vA.length > 1);
  var isSpatial = false;
  try { isSpatial = prop.isSpatial; } catch (e) {}

  var outEases = [], inEases = [];
  if (!isMultiDim || isSpatial) {
    // 1D scalar or spatial (single ease covers all dimensions)
    var dv = valueDiff(vA, vB);
    if (Math.abs(dv) < 1e-10) dv = 0;
    var pair = computeEasePair(lox, loy, lix, liy, dv, dt);
    outEases = [pair.easeOut];
    inEases  = [pair.easeIn];
  } else {
    // Non-spatial multi-dim (e.g. Scale): one KeyframeEase per dimension
    for (var d = 0; d < vA.length; d++) {
      var dv_d = vB[d] - vA[d];
      var pair_d = computeEasePair(lox, loy, lix, liy, dv_d, dt);
      outEases.push(pair_d.easeOut);
      inEases.push(pair_d.easeIn);
    }
  }

  try { prop.setTemporalEaseAtKey(kA, prop.keyInTemporalEase(kA), outEases); } catch (e2) {}
  try { prop.setTemporalEaseAtKey(kB, inEases, prop.keyOutTemporalEase(kB)); } catch (e2) {}
}

// Insert midpoint keyframes between kA and kB, then apply ease per sub-segment.
function applyFullCurveToSegment(prop, kA, kB, midPoints, handles) {
  if (!midPoints || midPoints.length === 0) {
    applySegment(prop, kA, kB, handles[0], { x: 0, y: 0 }, { x: 1, y: 1 });
    return;
  }

  var tA = prop.keyTime(kA);
  var tB = prop.keyTime(kB);
  var vA = prop.keyValue(kA);
  var vB = prop.keyValue(kB);
  var dt = tB - tA;

  var sorted = midPoints.slice(0).sort(function(a, b) { return a.x - b.x; });

  // Insert midpoint keyframes
  var midTimes = [];
  for (var m = 0; m < sorted.length; m++) {
    var t = tA + dt * sorted[m].x;
    var v = lerpValue(vA, vB, sorted[m].y);
    try { prop.setValueAtTime(t, v); } catch (e) {}
    midTimes.push(t);
  }

  // GUI anchors for coordinate transform
  var guiAnchors = [{ x: 0, y: 0 }];
  for (var ma = 0; ma < sorted.length; ma++) guiAnchors.push({ x: sorted[ma].x, y: sorted[ma].y });
  guiAnchors.push({ x: 1, y: 1 });

  var allTimes = [tA].concat(midTimes).concat([tB]);

  // Use time-based lookup so overshoot insertions inside applySegment don't break indices
  for (var s = 0; s < allTimes.length - 1; s++) {
    var k1 = findKeyAtTime(prop, allTimes[s]);
    var k2 = findKeyAtTime(prop, allTimes[s + 1]);
    if (k1 < 0 || k2 < 0) continue;
    var h = handles[Math.min(s, handles.length - 1)];
    applySegment(prop, k1, k2, h, guiAnchors[s], guiAnchors[s + 1]);
  }
}

// Apply the full curve to a sequence of key index pairs.
function applyToKeys(prop, keyIdxArr, midPoints, handles) {
  var indices = keyIdxArr.slice(0);
  if (indices.length === 1 && indices[0] < prop.numKeys) {
    indices = [indices[0], indices[0] + 1];
  }

  var numSegs  = midPoints.length + 1;
  var numPairs = indices.length - 1;

  // GUI anchor list for each ease segment
  var guiAnchors = [{ x: 0, y: 0 }];
  for (var ma = 0; ma < midPoints.length; ma++) guiAnchors.push({ x: midPoints[ma].x, y: midPoints[ma].y });
  guiAnchors.push({ x: 1, y: 1 });

  if (numPairs >= numSegs) {
    // Direct apply: cycle ease segments across keyframe pairs
    var shift1 = 0;
    for (var i = 0; i < numPairs; i++) {
      var si = i % numSegs;
      var kA = indices[i] + shift1;
      var kB = indices[i + 1] + shift1;
      if (kA < 1 || kB > prop.numKeys) continue;
      var before1 = prop.numKeys;
      applySegment(prop, kA, kB, handles[si], guiAnchors[si], guiAnchors[si + 1]);
      shift1 += (prop.numKeys - before1);
    }
  } else {
    // Insert midpoint keyframes, track index shift
    var shift2 = 0;
    for (var j = 0; j < numPairs; j++) {
      var kAj = indices[j] + shift2;
      var kBj = indices[j + 1] + shift2;
      if (kAj < 1 || kBj > prop.numKeys) continue;
      var before2 = prop.numKeys;
      applyFullCurveToSegment(prop, kAj, kBj, midPoints, handles);
      shift2 += (prop.numKeys - before2);
    }
  }
}


// ─── Public functions (called from React via evalScript) ──────────────────────

function smoothio_applyEasing(curveData, separateDim) {
  var curve    = curveData;
  var separate = separateDim;

  var comp = getComp();
  if (!comp) return err('No active composition');

  var handles  = curve.handles   || [];
  var midPts   = curve.midPoints || [];
  if (!handles.length) return err('Empty curve');

  var hasOvershoot = curveHasOvershoot(handles, midPts);

  app.beginUndoGroup('Smoothio: Apply Easing');
  var count = 0;

  try {
    for (var li = 0; li < comp.selectedLayers.length; li++) {
      var layer = comp.selectedLayers[li];

      if (separate || hasOvershoot) {
        walkProps(layer, function (prop) {
          if (prop.dimensionsSeparated !== undefined && !prop.dimensionsSeparated) {
            try { prop.dimensionsSeparated = true; } catch (e) {}
          }
        });
      }

      var targetProps = [];
      walkProps(layer, function (prop) {
        if (prop.numKeys < 1) return;
        var sk = selKeys(prop);
        if (sk.length > 0) targetProps.push({ prop: prop, keys: sk });
      });

      if (targetProps.length === 0) {
        walkProps(layer, function (prop) {
          if (prop.numKeys >= 2) targetProps.push({ prop: prop, keys: allKeys(prop) });
        });
      }

      for (var pi = 0; pi < targetProps.length; pi++) {
        var info = targetProps[pi];
        applyToKeys(info.prop, info.keys, midPts, handles);
        count++;
      }
    }

    app.endUndoGroup();
    if (count === 0) return err('Nothing to apply — select a layer or keyframes');
    return ok();
  } catch (e) {
    app.endUndoGroup();
    return err(e);
  }
}

function smoothio_resetEase() {
  var comp = getComp();
  if (!comp) return err('No active composition');

  app.beginUndoGroup('Smoothio: Reset to Linear');
  var count = 0;

  try {
    for (var li = 0; li < comp.selectedLayers.length; li++) {
      walkProps(comp.selectedLayers[li], function (prop) {
        var sk = selKeys(prop);
        if (sk.length === 0) sk = allKeys(prop);
        for (var ki = 0; ki < sk.length; ki++) {
          try {
            prop.setInterpolationTypeAtKey(
              sk[ki],
              KeyframeInterpolationType.LINEAR,
              KeyframeInterpolationType.LINEAR
            );
            count++;
          } catch (e) {}
        }
      });
    }
    app.endUndoGroup();
    return ok();
  } catch (e) {
    app.endUndoGroup();
    return err(e);
  }
}

function smoothio_importEase() {
  var comp = getComp();
  if (!comp) return err('No active composition');

  var found = null;
  for (var li = 0; li < comp.selectedLayers.length; li++) {
    walkProps(comp.selectedLayers[li], function (prop) {
      if (!found && prop.numKeys >= 2 && selKeys(prop).length >= 2) found = prop;
    });
    if (found) break;
  }
  if (!found) return err('Select ≥2 keyframes on a property');

  var prop = found;
  var sk = selKeys(prop);
  var handles = [];

  for (var i = 0; i < sk.length - 1; i++) {
    var kA = sk[i], kB = sk[i + 1];
    var dt = prop.keyTime(kB) - prop.keyTime(kA);
    if (dt <= 0) continue;

    var dv = valueDiff(prop.keyValue(kA), prop.keyValue(kB));
    if (Math.abs(dv) < 1e-6) dv = 1;

    var outArr = prop.keyOutTemporalEase(kA);
    var inArr  = prop.keyInTemporalEase(kB);
    var eOut = outArr[0], eIn = inArr[0];

    var outX = eOut.influence / 100;
    var outY = (eOut.speed * outX * dt) / Math.abs(dv);
    var inX  = 1 - eIn.influence / 100;
    var inY  = 1 - (eIn.speed * (1 - inX) * dt) / Math.abs(dv);

    var hEntry = { out: { x: outX, y: outY } };
    hEntry['in'] = { x: inX, y: inY };
    handles.push(hEntry);
  }

  if (!handles.length) return err('Could not extract handles');

  var midPoints = [];
  for (var j = 1; j < sk.length - 1; j++) {
    var kM = sk[j];
    var tA0 = prop.keyTime(sk[0]);
    var tB0 = prop.keyTime(sk[sk.length - 1]);
    var tM  = prop.keyTime(kM);
    var mx  = (tM - tA0) / (tB0 - tA0);
    var vA0 = prop.keyValue(sk[0]);
    var vB0 = prop.keyValue(sk[sk.length - 1]);
    var vM  = prop.keyValue(kM);
    var totalDv = valueDiff(vA0, vB0);
    var my = (Math.abs(totalDv) > 1e-6) ? valueDiff(vA0, vM) / totalDv : 0.5;
    midPoints.push({ x: mx, y: my });
  }

  return JSON.stringify({ ok: true, curve: { midPoints: midPoints, handles: handles } });
}

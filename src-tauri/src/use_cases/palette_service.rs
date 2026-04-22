//! Palette orchestration.
//!
//! Owns:
//!   - a global [`PaletteStore`] (bound to `<app_data_dir>/palettes/`)
//!   - an optional project [`PaletteStore`] (bound to
//!     `<project>/palettes/` — instantiated when a project opens)
//!   - an [`ActiveMemoryStore`] persisting the remembered active palette
//!     per context (`<app_data_dir>/palette-state.json`)
//!   - a [`PaletteCodec`] used by `export_palette` / `import_palette`.
//!
//! All I/O happens behind these three domain ports. This file therefore
//! imports only from `crate::domain::*` and `uuid` (id generation), which
//! matches the editor_service precedent and satisfies Principle I.
//!
//! Return type convention: everything returns `Result<_, DomainError>`.
//! The command layer translates to `AppError` at the IPC boundary.

use std::path::PathBuf;

use uuid::Uuid;

use crate::domain::{
    ActiveMemory, ActiveMemoryStore, AddColorOutcome, Color, DomainError, Palette, PaletteCodec,
    PaletteId, PaletteName, PaletteScope, PaletteStore,
};

/// User-chosen resolution strategy for a name collision on import.
#[derive(Debug, Clone)]
pub enum ImportStrategy {
    Cancel,
    Rename { new_name: String },
    Overwrite,
}

pub struct PaletteService {
    global: Box<dyn PaletteStore + Send + Sync>,
    project: Option<Box<dyn PaletteStore + Send + Sync>>,
    active: ActiveMemory,
    current_project_path: Option<PathBuf>,
    memory_store: Box<dyn ActiveMemoryStore + Send + Sync>,
    codec: Box<dyn PaletteCodec + Send + Sync>,
}

fn rule(code: impl Into<String>) -> DomainError {
    DomainError::RuleViolation(code.into())
}

/// Wraps a `PaletteName::new` failure as the `invalid-palette-name:<reason>`
/// code documented in contracts/commands.md.
fn parse_name(raw: &str) -> Result<PaletteName, DomainError> {
    PaletteName::new(raw).map_err(|e| rule(format!("invalid-palette-name:{e}")))
}

impl PaletteService {
    /// Constructs the service. `memory_store.load()` is invoked to restore
    /// the last-active-palette memory; any I/O error is returned so the
    /// caller (Tauri `setup(...)`) can decide what to do.
    pub fn new(
        global: Box<dyn PaletteStore + Send + Sync>,
        memory_store: Box<dyn ActiveMemoryStore + Send + Sync>,
        codec: Box<dyn PaletteCodec + Send + Sync>,
    ) -> Result<Self, DomainError> {
        let active = memory_store.load()?;
        Ok(Self {
            global,
            project: None,
            active,
            current_project_path: None,
            memory_store,
            codec,
        })
    }

    pub fn set_project_store(
        &mut self,
        store: Box<dyn PaletteStore + Send + Sync>,
        project_path: PathBuf,
    ) {
        self.project = Some(store);
        self.current_project_path = Some(project_path);
    }

    pub fn clear_project_store(&mut self) {
        self.project = None;
        self.current_project_path = None;
    }

    pub fn current_project_path(&self) -> Option<&PathBuf> {
        self.current_project_path.as_ref()
    }

    pub fn can_create_project_palette(&self) -> bool {
        self.project.is_some()
    }

    /// Returns all palettes across both stores. Project palettes are listed
    /// first (alphabetical by name), then global palettes (alphabetical).
    pub fn list_all(&self) -> Result<Vec<Palette>, DomainError> {
        let mut project = self
            .project
            .as_ref()
            .map(|s| s.list())
            .transpose()?
            .unwrap_or_default();
        project.sort_by(|a, b| a.name().as_str().cmp(b.name().as_str()));

        let mut global = self.global.list()?;
        global.sort_by(|a, b| a.name().as_str().cmp(b.name().as_str()));

        project.extend(global);
        Ok(project)
    }

    /// Reads a specific palette by id, searching project store first (if
    /// open) then global.
    pub fn read(&self, id: PaletteId) -> Result<Palette, DomainError> {
        if let Some(store) = &self.project {
            if let Ok(p) = store.read(id) {
                return Ok(p);
            }
        }
        self.global.read(id)
    }

    /// Resolves which palette should be active given the current context,
    /// applying the FR-023a fallback chain.
    pub fn resolve_active(&self) -> Result<Option<PaletteId>, DomainError> {
        let all = self.list_all()?;
        let remembered = match &self.current_project_path {
            Some(path) => self
                .active
                .projects
                .get(path)
                .copied()
                .or(self.active.global),
            None => self.active.global,
        };

        if let Some(id) = remembered {
            if all.iter().any(|p| p.id() == id) {
                return Ok(Some(id));
            }
        }

        Ok(all.first().map(|p| p.id()))
    }

    pub fn active_palette_id(&self) -> Result<Option<PaletteId>, DomainError> {
        self.resolve_active()
    }

    /// Explicitly sets the active palette. `None` clears it.
    pub fn set_active_palette(&mut self, id: Option<PaletteId>) -> Result<(), DomainError> {
        match &self.current_project_path {
            Some(path) => match id {
                Some(id) => {
                    self.active.projects.insert(path.clone(), id);
                }
                None => {
                    self.active.projects.remove(path);
                }
            },
            None => {
                self.active.global = id;
            }
        }
        self.memory_store.save(&self.active)
    }

    fn store_for(
        &self,
        scope: PaletteScope,
    ) -> Result<&(dyn PaletteStore + Send + Sync), DomainError> {
        match scope {
            PaletteScope::Global => Ok(self.global.as_ref()),
            PaletteScope::Project => self
                .project
                .as_deref()
                .ok_or_else(|| rule("no-project-open")),
        }
    }

    fn name_exists_in_scope(
        &self,
        scope: PaletteScope,
        name: &PaletteName,
        ignore_id: Option<PaletteId>,
    ) -> Result<bool, DomainError> {
        let store = self.store_for(scope)?;
        for p in store.list()? {
            if Some(p.id()) == ignore_id {
                continue;
            }
            if names_conflict(p.name(), name) {
                return Ok(true);
            }
        }
        Ok(false)
    }

    pub fn create_palette(
        &mut self,
        raw_name: &str,
        scope: PaletteScope,
    ) -> Result<PaletteId, DomainError> {
        let name = parse_name(raw_name)?;
        if self.name_exists_in_scope(scope, &name, None)? {
            return Err(rule("duplicate-palette-name"));
        }
        let id = PaletteId::from_value(Uuid::new_v4().as_u128());
        let palette = Palette::new(id, name, scope);
        self.store_for(scope)?.write(&palette)?;
        self.set_active_palette(Some(id))?;
        Ok(id)
    }

    pub fn rename_palette(&mut self, id: PaletteId, raw_name: &str) -> Result<(), DomainError> {
        let mut palette = self.read(id).map_err(|_| rule("palette-not-found"))?;
        let new_name = parse_name(raw_name)?;
        if self.name_exists_in_scope(palette.scope(), &new_name, Some(id))? {
            return Err(rule("duplicate-palette-name"));
        }
        palette.rename(new_name);
        self.store_for(palette.scope())?.write(&palette)?;
        Ok(())
    }

    pub fn delete_palette(&mut self, id: PaletteId) -> Result<(), DomainError> {
        let palette = self.read(id).map_err(|_| rule("palette-not-found"))?;
        self.store_for(palette.scope())?.delete(id)?;

        if self.active.global == Some(id) {
            self.active.global = None;
        }
        let stale: Vec<PathBuf> = self
            .active
            .projects
            .iter()
            .filter_map(|(path, pid)| if *pid == id { Some(path.clone()) } else { None })
            .collect();
        for path in stale {
            self.active.projects.remove(&path);
        }
        self.memory_store.save(&self.active)
    }

    fn mutate_active<R>(
        &mut self,
        mutation: impl FnOnce(&mut Palette) -> R,
    ) -> Result<(R, Palette), DomainError> {
        let id = self
            .resolve_active()?
            .ok_or_else(|| rule("no-active-palette"))?;
        let mut palette = self.read(id)?;
        let result = mutation(&mut palette);
        self.store_for(palette.scope())?.write(&palette)?;
        Ok((result, palette))
    }

    pub fn add_color_to_active(
        &mut self,
        color: Color,
    ) -> Result<(AddColorOutcome, Palette), DomainError> {
        self.mutate_active(|p| p.add_color(color))
    }

    pub fn remove_color_from_active_at(&mut self, index: usize) -> Result<Palette, DomainError> {
        let (result, palette) = self.mutate_active(|p| p.remove_color_at(index))?;
        result.map_err(|_| rule("palette-index-out-of-range"))?;
        Ok(palette)
    }

    /// Serializes the palette identified by `id` to `dest_path`. The
    /// filesystem `write` error is surfaced as `DomainError::IoError` so
    /// the command layer can translate it to the documented `io-error:…`
    /// code.
    pub fn export_palette(
        &self,
        id: PaletteId,
        dest_path: &std::path::Path,
    ) -> Result<(), DomainError> {
        let palette = self.read(id).map_err(|_| rule("palette-not-found"))?;
        let json = self.codec.encode(&palette)?;
        std::fs::write(dest_path, json).map_err(|e| DomainError::IoError {
            reason: e.to_string(),
        })
    }

    /// Imports a palette file into the given scope. On name collision
    /// without a strategy, returns a `RuleViolation` carrying the
    /// `palette-name-collision:<existing-id>:<suggested-name>` code.
    pub fn import_palette(
        &mut self,
        source_path: &std::path::Path,
        scope: PaletteScope,
        strategy: Option<ImportStrategy>,
    ) -> Result<Option<PaletteId>, DomainError> {
        if matches!(scope, PaletteScope::Project) && self.project.is_none() {
            return Err(rule("no-project-open"));
        }

        let raw = std::fs::read_to_string(source_path).map_err(|e| DomainError::IoError {
            reason: e.to_string(),
        })?;
        let incoming = self.codec.decode(&raw, scope)?;

        match strategy {
            Some(ImportStrategy::Cancel) => Ok(None),
            Some(ImportStrategy::Rename { new_name }) => {
                let renamed_name = parse_name(&new_name)?;
                if self.name_exists_in_scope(scope, &renamed_name, None)? {
                    let existing = self.find_by_name(scope, &renamed_name)?;
                    let suggested = self.suggest_unique_name(scope, renamed_name.as_str())?;
                    return Err(rule(format!(
                        "palette-name-collision:{}:{}",
                        existing.to_hex_string(),
                        suggested
                    )));
                }
                let id = PaletteId::from_value(Uuid::new_v4().as_u128());
                let mut fresh = Palette::new(id, renamed_name, scope);
                for c in incoming.colors() {
                    fresh.add_color(*c);
                }
                self.store_for(scope)?.write(&fresh)?;
                self.set_active_palette(Some(id))?;
                Ok(Some(id))
            }
            Some(ImportStrategy::Overwrite) => {
                let existing_id = self
                    .find_by_name(scope, incoming.name())
                    .map_err(|_| rule("palette-not-found"))?;
                let mut updated = Palette::new(existing_id, incoming.name().clone(), scope);
                for c in incoming.colors() {
                    updated.add_color(*c);
                }
                self.store_for(scope)?.write(&updated)?;
                self.set_active_palette(Some(existing_id))?;
                Ok(Some(existing_id))
            }
            None => {
                if let Ok(existing_id) = self.find_by_name(scope, incoming.name()) {
                    let suggested = self.suggest_unique_name(scope, incoming.name().as_str())?;
                    return Err(rule(format!(
                        "palette-name-collision:{}:{}",
                        existing_id.to_hex_string(),
                        suggested
                    )));
                }
                self.store_for(scope)?.write(&incoming)?;
                let id = incoming.id();
                self.set_active_palette(Some(id))?;
                Ok(Some(id))
            }
        }
    }

    fn find_by_name(
        &self,
        scope: PaletteScope,
        name: &PaletteName,
    ) -> Result<PaletteId, DomainError> {
        let store = self.store_for(scope)?;
        for p in store.list()? {
            if names_conflict(p.name(), name) {
                return Ok(p.id());
            }
        }
        Err(rule("palette-not-found"))
    }

    fn suggest_unique_name(&self, scope: PaletteScope, base: &str) -> Result<String, DomainError> {
        for n in 2..=999 {
            let candidate = format!("{base} ({n})");
            let name = match PaletteName::new(&candidate) {
                Ok(n) => n,
                Err(_) => continue,
            };
            if !self.name_exists_in_scope(scope, &name, None)? {
                return Ok(candidate);
            }
        }
        Ok(format!("{base} (copy)"))
    }
}

fn names_conflict(a: &PaletteName, b: &PaletteName) -> bool {
    #[cfg(target_os = "windows")]
    {
        a.eq_ignore_ascii_case(b)
    }
    #[cfg(not(target_os = "windows"))]
    {
        a == b
    }
}

#[cfg(test)]
#[allow(clippy::unwrap_used)]
mod tests {
    use super::*;
    use crate::domain::ports::HashMapPaletteStore;
    use std::path::Path;
    use std::sync::Arc;
    use std::sync::Mutex;

    /// In-memory `ActiveMemoryStore` used by service tests. Holds the
    /// persisted snapshot so tests can observe writes and reuse state
    /// across service constructions (needed by the restore-across-reopen
    /// test split under E1).
    #[derive(Default, Clone)]
    struct InMemoryMemoryStore {
        inner: Arc<Mutex<ActiveMemory>>,
    }

    impl ActiveMemoryStore for InMemoryMemoryStore {
        fn load(&self) -> Result<ActiveMemory, DomainError> {
            Ok(self.inner.lock().expect("lock").clone())
        }
        fn save(&self, memory: &ActiveMemory) -> Result<(), DomainError> {
            *self.inner.lock().expect("lock") = memory.clone();
            Ok(())
        }
    }

    /// Test double for [`PaletteCodec`] that round-trips via a small JSON
    /// shape. Using a dedicated double keeps the use-case tests
    /// independent of the real `.texpal` wire format.
    struct TestCodec;

    impl PaletteCodec for TestCodec {
        fn encode(&self, palette: &Palette) -> Result<String, DomainError> {
            let mut s = String::new();
            s.push_str(&palette.id().to_hex_string());
            s.push('\n');
            s.push_str(palette.name().as_str());
            for c in palette.colors() {
                s.push('\n');
                s.push_str(&c.to_hex_rgb());
            }
            Ok(s)
        }
        fn decode(&self, raw: &str, scope: PaletteScope) -> Result<Palette, DomainError> {
            let mut lines = raw.lines();
            let id_hex = lines
                .next()
                .ok_or_else(|| rule("invalid-palette-file:empty"))?;
            let name = lines
                .next()
                .ok_or_else(|| rule("invalid-palette-file:no-name"))?;
            let id = PaletteId::from_hex(id_hex)
                .map_err(|e| rule(format!("invalid-palette-file:bad-id:{e}")))?;
            let pname = PaletteName::new(name)
                .map_err(|e| rule(format!("invalid-palette-file:bad-name:{e}")))?;
            let mut colors = Vec::new();
            for line in lines {
                let c = Color::from_hex_rgb(line)
                    .map_err(|e| rule(format!("invalid-palette-file:bad-color:{e}")))?;
                colors.push(c);
            }
            Ok(Palette::from_parts(id, pname, scope, colors))
        }
    }

    fn svc(with_project: bool) -> PaletteService {
        let global = Box::new(HashMapPaletteStore::new());
        let memory = Box::new(InMemoryMemoryStore::default());
        let codec = Box::new(TestCodec);
        let mut s = PaletteService::new(global, memory, codec).unwrap();
        if with_project {
            s.set_project_store(
                Box::new(HashMapPaletteStore::new()),
                PathBuf::from("C:/project"),
            );
        }
        s
    }

    // --- Create / uniqueness ---

    #[test]
    fn create_then_list() {
        let mut s = svc(false);
        s.create_palette("Blues", PaletteScope::Global).unwrap();
        assert_eq!(s.list_all().unwrap().len(), 1);
    }

    #[test]
    fn create_auto_selects_new_palette() {
        let mut s = svc(false);
        let id = s.create_palette("Blues", PaletteScope::Global).unwrap();
        assert_eq!(s.active_palette_id().unwrap(), Some(id));
    }

    #[test]
    fn create_rejects_duplicate_name_in_scope() {
        let mut s = svc(false);
        s.create_palette("Blues", PaletteScope::Global).unwrap();
        let err = s.create_palette("Blues", PaletteScope::Global).unwrap_err();
        assert!(err.to_string().contains("duplicate-palette-name"));
    }

    #[test]
    fn create_rejects_invalid_name() {
        let mut s = svc(false);
        let err = s.create_palette("   ", PaletteScope::Global).unwrap_err();
        assert!(err.to_string().contains("invalid-palette-name"));
    }

    #[test]
    fn create_project_scope_without_project_errors() {
        let mut s = svc(false);
        let err = s.create_palette("Proj", PaletteScope::Project).unwrap_err();
        assert!(err.to_string().contains("no-project-open"));
    }

    // --- Rename ---

    #[test]
    fn rename_preserves_id() {
        let mut s = svc(false);
        let id = s.create_palette("Old", PaletteScope::Global).unwrap();
        s.rename_palette(id, "New").unwrap();
        let read = s.read(id).unwrap();
        assert_eq!(read.name().as_str(), "New");
    }

    #[test]
    fn rename_rejects_duplicate() {
        let mut s = svc(false);
        s.create_palette("A", PaletteScope::Global).unwrap();
        let b = s.create_palette("B", PaletteScope::Global).unwrap();
        let err = s.rename_palette(b, "A").unwrap_err();
        assert!(err.to_string().contains("duplicate-palette-name"));
    }

    #[test]
    fn rename_unknown_id_errors() {
        let mut s = svc(false);
        let err = s
            .rename_palette(PaletteId::from_value(77), "x")
            .unwrap_err();
        assert!(err.to_string().contains("palette-not-found"));
    }

    // --- Delete + FR-023a reselect ---

    #[test]
    fn delete_triggers_fallback_reselect() {
        let mut s = svc(false);
        let a = s.create_palette("A", PaletteScope::Global).unwrap();
        let b = s.create_palette("B", PaletteScope::Global).unwrap();
        assert_eq!(s.active_palette_id().unwrap(), Some(b));
        s.delete_palette(b).unwrap();
        assert_eq!(
            s.active_palette_id().unwrap(),
            Some(a),
            "fallback must pick the remaining palette"
        );
    }

    #[test]
    fn delete_empty_yields_none() {
        let mut s = svc(false);
        let id = s.create_palette("A", PaletteScope::Global).unwrap();
        s.delete_palette(id).unwrap();
        assert_eq!(s.active_palette_id().unwrap(), None);
    }

    // --- add_color / remove ---

    #[test]
    fn add_color_to_active_works() {
        let mut s = svc(false);
        s.create_palette("A", PaletteScope::Global).unwrap();
        let (outcome, palette) = s.add_color_to_active(Color::new(1, 2, 3, 255)).unwrap();
        assert!(matches!(outcome, AddColorOutcome::Added { index: 0 }));
        assert_eq!(palette.len(), 1);
    }

    #[test]
    fn add_color_dedupe_reports_already_present() {
        let mut s = svc(false);
        s.create_palette("A", PaletteScope::Global).unwrap();
        s.add_color_to_active(Color::new(1, 2, 3, 255)).unwrap();
        let (outcome, _) = s.add_color_to_active(Color::new(1, 2, 3, 255)).unwrap();
        assert!(matches!(
            outcome,
            AddColorOutcome::AlreadyPresent { index: 0 }
        ));
    }

    #[test]
    fn remove_color_out_of_range_validation_error() {
        let mut s = svc(false);
        s.create_palette("A", PaletteScope::Global).unwrap();
        let err = s.remove_color_from_active_at(5).unwrap_err();
        assert!(err.to_string().contains("palette-index-out-of-range"));
    }

    #[test]
    fn add_color_without_active_errors() {
        let mut s = svc(false);
        let err = s.add_color_to_active(Color::new(1, 2, 3, 255)).unwrap_err();
        assert!(err.to_string().contains("no-active-palette"));
    }

    // --- Scope routing ---

    #[test]
    fn with_project_list_project_first_alphabetical() {
        let mut s = svc(true);
        s.create_palette("Zeta", PaletteScope::Global).unwrap();
        s.create_palette("Alpha", PaletteScope::Global).unwrap();
        s.create_palette("Proj B", PaletteScope::Project).unwrap();
        s.create_palette("Proj A", PaletteScope::Project).unwrap();
        let names: Vec<String> = s
            .list_all()
            .unwrap()
            .into_iter()
            .map(|p| p.name().as_str().to_owned())
            .collect();
        assert_eq!(names, vec!["Proj A", "Proj B", "Alpha", "Zeta"]);
    }

    #[test]
    fn clear_project_store_hides_project_palettes() {
        let mut s = svc(true);
        s.create_palette("Global", PaletteScope::Global).unwrap();
        s.create_palette("Proj", PaletteScope::Project).unwrap();
        s.clear_project_store();
        let names: Vec<String> = s
            .list_all()
            .unwrap()
            .into_iter()
            .map(|p| p.name().as_str().to_owned())
            .collect();
        assert_eq!(names, vec!["Global"]);
    }

    // --- E1: split per-project memory behavior into two crisp scenarios ---

    /// A: switching to a *different* project does not carry over memory
    /// from the previous project.
    #[test]
    fn switching_projects_isolates_memory() {
        let mut s = svc(true);
        let pid = s.create_palette("Proj", PaletteScope::Project).unwrap();
        assert_eq!(s.active_palette_id().unwrap(), Some(pid));

        s.clear_project_store();
        s.set_project_store(
            Box::new(HashMapPaletteStore::new()),
            PathBuf::from("C:/project2"),
        );
        assert_eq!(
            s.active_palette_id().unwrap(),
            None,
            "project 2 has no palettes and no remembered id"
        );
    }

    /// B: reopening the *same* project (same store contents) restores the
    /// last active palette for that project. This covers the
    /// "reactivated on reopen" requirement from T054(d) that the original
    /// test accidentally did not verify.
    #[test]
    fn reopen_same_project_restores_active_palette() {
        // Shared in-memory store — survives the set/clear/set cycle.
        let shared_project_store: Arc<HashMapPaletteStore> = Arc::new(HashMapPaletteStore::new());
        let shared_memory: InMemoryMemoryStore = InMemoryMemoryStore::default();

        let mut s = PaletteService::new(
            Box::new(HashMapPaletteStore::new()),
            Box::new(shared_memory.clone()),
            Box::new(TestCodec),
        )
        .unwrap();
        s.set_project_store(
            Box::new(ArcStore(Arc::clone(&shared_project_store))),
            PathBuf::from("C:/project"),
        );

        let pid = s.create_palette("Proj", PaletteScope::Project).unwrap();
        assert_eq!(s.active_palette_id().unwrap(), Some(pid));

        // Close project, then reopen with the same underlying store.
        s.clear_project_store();
        s.set_project_store(
            Box::new(ArcStore(Arc::clone(&shared_project_store))),
            PathBuf::from("C:/project"),
        );

        assert_eq!(
            s.active_palette_id().unwrap(),
            Some(pid),
            "remembered project palette must be reactivated on reopen"
        );
    }

    /// Thin `PaletteStore` wrapper over `Arc<HashMapPaletteStore>` so two
    /// service instances (or a before/after snapshot) can share the same
    /// underlying in-memory state. Used by
    /// `reopen_same_project_restores_active_palette`.
    struct ArcStore(Arc<HashMapPaletteStore>);

    impl PaletteStore for ArcStore {
        fn list(&self) -> Result<Vec<Palette>, DomainError> {
            self.0.list()
        }
        fn read(&self, id: PaletteId) -> Result<Palette, DomainError> {
            self.0.read(id)
        }
        fn write(&self, palette: &Palette) -> Result<(), DomainError> {
            self.0.write(palette)
        }
        fn delete(&self, id: PaletteId) -> Result<(), DomainError> {
            self.0.delete(id)
        }
    }

    #[test]
    fn set_project_store_picks_up_out_of_band_entry() {
        let mut s = svc(false);
        let store = HashMapPaletteStore::new();
        store.seed(Palette::new(
            PaletteId::from_value(7),
            PaletteName::new("PreExisting").unwrap(),
            PaletteScope::Project,
        ));
        s.set_project_store(Box::new(store), PathBuf::from("C:/project"));
        let names: Vec<String> = s
            .list_all()
            .unwrap()
            .into_iter()
            .map(|p| p.name().as_str().to_owned())
            .collect();
        assert_eq!(names, vec!["PreExisting"]);
    }

    // --- Export / Import ---

    fn tmp_file(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("texlab_svc_{}", Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        dir.join(name)
    }

    fn cleanup_parent(path: &Path) {
        if let Some(p) = path.parent() {
            let _ = std::fs::remove_dir_all(p);
        }
    }

    #[test]
    fn export_then_import_roundtrip() {
        let mut s = svc(false);
        let id = s.create_palette("Blues", PaletteScope::Global).unwrap();
        s.add_color_to_active(Color::new(1, 2, 3, 255)).unwrap();

        let export_path = tmp_file("Blues.texpal");
        s.export_palette(id, &export_path).unwrap();

        s.delete_palette(id).unwrap();
        assert_eq!(s.list_all().unwrap().len(), 0);

        let new_id = s
            .import_palette(&export_path, PaletteScope::Global, None)
            .unwrap()
            .unwrap();
        assert_eq!(new_id, id, "import should preserve original id");
        let p = s.read(new_id).unwrap();
        assert_eq!(p.colors().len(), 1);
        cleanup_parent(&export_path);
    }

    #[test]
    fn import_collision_without_strategy_returns_error_code() {
        let mut s = svc(false);
        let id = s.create_palette("Blues", PaletteScope::Global).unwrap();
        let export_path = tmp_file("Blues.texpal");
        s.export_palette(id, &export_path).unwrap();
        let err = s
            .import_palette(&export_path, PaletteScope::Global, None)
            .unwrap_err();
        assert!(
            err.to_string().contains("palette-name-collision:"),
            "got: {err}"
        );
        assert!(err.to_string().contains("Blues (2)"));
        cleanup_parent(&export_path);
    }

    #[test]
    fn import_cancel_strategy_noop() {
        let mut s = svc(false);
        let id = s.create_palette("Blues", PaletteScope::Global).unwrap();
        let export_path = tmp_file("Blues.texpal");
        s.export_palette(id, &export_path).unwrap();
        let before = s.list_all().unwrap().len();
        let out = s
            .import_palette(
                &export_path,
                PaletteScope::Global,
                Some(ImportStrategy::Cancel),
            )
            .unwrap();
        assert!(out.is_none());
        assert_eq!(s.list_all().unwrap().len(), before);
        cleanup_parent(&export_path);
    }

    #[test]
    fn import_rename_strategy_creates_new_palette() {
        let mut s = svc(false);
        let id = s.create_palette("Blues", PaletteScope::Global).unwrap();
        let export_path = tmp_file("Blues.texpal");
        s.export_palette(id, &export_path).unwrap();
        s.import_palette(
            &export_path,
            PaletteScope::Global,
            Some(ImportStrategy::Rename {
                new_name: "Blues (2)".to_owned(),
            }),
        )
        .unwrap();
        let names: Vec<String> = s
            .list_all()
            .unwrap()
            .into_iter()
            .map(|p| p.name().as_str().to_owned())
            .collect();
        assert!(names.contains(&"Blues".to_owned()));
        assert!(names.contains(&"Blues (2)".to_owned()));
        cleanup_parent(&export_path);
    }

    #[test]
    fn import_overwrite_strategy_preserves_existing_id() {
        let mut s = svc(false);
        let id = s.create_palette("Blues", PaletteScope::Global).unwrap();
        let export_path = tmp_file("Blues.texpal");
        s.export_palette(id, &export_path).unwrap();
        let returned = s
            .import_palette(
                &export_path,
                PaletteScope::Global,
                Some(ImportStrategy::Overwrite),
            )
            .unwrap()
            .unwrap();
        assert_eq!(returned, id);
        cleanup_parent(&export_path);
    }

    #[test]
    fn import_rename_to_another_collision_errors_again() {
        let mut s = svc(false);
        s.create_palette("A", PaletteScope::Global).unwrap();
        s.create_palette("B", PaletteScope::Global).unwrap();
        let b_id = s
            .list_all()
            .unwrap()
            .iter()
            .find(|p| p.name().as_str() == "B")
            .unwrap()
            .id();
        let export_path = tmp_file("B.texpal");
        s.export_palette(b_id, &export_path).unwrap();
        let err = s
            .import_palette(
                &export_path,
                PaletteScope::Global,
                Some(ImportStrategy::Rename {
                    new_name: "A".to_owned(),
                }),
            )
            .unwrap_err();
        assert!(err.to_string().contains("palette-name-collision:"));
        cleanup_parent(&export_path);
    }

    // --- Windows-specific case-insensitive name conflict ---

    #[cfg(target_os = "windows")]
    #[test]
    fn windows_case_insensitive_name_collision() {
        let mut s = svc(false);
        s.create_palette("Blues", PaletteScope::Global).unwrap();
        let err = s.create_palette("blues", PaletteScope::Global).unwrap_err();
        assert!(err.to_string().contains("duplicate-palette-name"));
    }

    #[cfg(not(target_os = "windows"))]
    #[test]
    fn unix_case_sensitive_name_allows_both() {
        let mut s = svc(false);
        s.create_palette("Blues", PaletteScope::Global).unwrap();
        assert!(s.create_palette("blues", PaletteScope::Global).is_ok());
    }
}

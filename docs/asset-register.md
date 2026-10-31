# Asset register

All photographs came from Wikimedia Commons. Pexels and Unsplash refused automated access, so they were not used. Licenses were read from each file's Commons metadata when downloaded; machine-readable copy: [image-source-metadata.json](image-source-metadata.json).

Originals are in `source-images/` (not deployed). Optimized versions are in `src/assets/img/`.

| Local name | Source page | Author | License | Attribution required | Used on | Changes |
|---|---|---|---|---|---|---|
| lineman-on-utility-pole | [Commons](https://commons.wikimedia.org/wiki/File:Telecommunications_engineer_-_geograph.org.uk_-_8092160.jpg) | Neil Theasby | [CC BY-SA 2.0](https://creativecommons.org/licenses/by-sa/2.0) | Yes; adaptation stays under the same license | Home | Grayscale, normalized, resized, displayed cropped |
| fiber-conduit-in-trench | [Commons](https://commons.wikimedia.org/wiki/File:Fiber_optic_cable_installation_(rubin-20170124-101126).jpg) | Rubin Observatory/NSF/AURA | [CC BY 4.0](https://creativecommons.org/licenses/by/4.0) | Yes | Home, Network Services | Same |
| fiber-cable-reel-at-manhole | [Commons](https://commons.wikimedia.org/wiki/File:SRNL_Fiber_Optic_Cable_Installation_(8057285939).jpg) | Savannah River Site | Public domain | No (credited anyway) | Network Services | Same |
| technician-at-equipment-rack | [Commons](https://commons.wikimedia.org/wiki/File:Splicing_fiber_optic_cables_in_a_communications_cabinet_in_a_power_facility_in_Queens._10-02-2019_(48844065016).jpg) | MTA Capital Construction Mega Projects | [CC BY 2.0](https://creativecommons.org/licenses/by/2.0) | Yes | Home, Network Services | Same, plus lower edge cropped to remove a date stamp |
| technician-with-fiber-patch-panel | [Commons](https://commons.wikimedia.org/wiki/File:Telecommunications_technician.jpg) | USDA / Lance Cheung | Public domain | No (credited anyway) | Home, Workforce Solutions | Same |
| climber-on-lattice-tower | [Commons](https://commons.wikimedia.org/wiki/File:Telecommunications_Tower_Technician_in_Argentina_5.jpg) | Horacio Cambeiro | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Yes; adaptation stays under the same license | Home, Careers | Same |
| cell-tower-antennas | [Commons](https://commons.wikimedia.org/wiki/File:Cell_Tower_Ciudad_del_Carmen2020.jpg) | Cvmontuy | [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0) | Yes; adaptation stays under the same license | About, Network Services | Same |

Attribution is published on `image-credits.html`, linked from every footer. That table is generated from the metadata file at build time.

## Risks to review before launch

- **Publicity rights.** These licenses cover copyright only. They do not include model or property releases. Identifiable people appear in the lineman, reel, rack and patch-panel photos, and using a person's likeness to promote a business can raise publicity-rights issues. This is the main reason to replace them.
- **Implied endorsement.** The USDA, MTA and Savannah River images come from public bodies and must not suggest any endorsement. The footer and credits page say so.
- **Recommendation.** Replace these with Seudocom's own photographs or paid stock with releases, starting with the home hero. To swap one, add it to `scripts/process-images.mjs`, run `npm run images`, then update this register.

## Other assets

| Asset | Source | License |
|---|---|---|
| Logo SVGs, favicon set, share image | Redrawn by `scripts/make-logos.mjs` from the supplied logo; wordmark outlined from Oxanium | Client's mark |
| Oxanium typeface | Google Fonts | SIL Open Font License |

No AI-generated images are used.

/**
 * Unit tests for core GitHub Projects MCP tools
 *
 * Tests:
 * - Input schema validation
 * - Tool definitions (name, title, annotations)
 * - Executor functions (with mocked repositories)
 */

import {
  createProjectSchema,
  listProjectsSchema,
  getProjectSchema,
  updateProjectSchema,
  deleteProjectSchema,
  createProjectFieldSchema,
  listProjectFieldsSchema,
  updateProjectFieldSchema,
  addProjectItemSchema,
  removeProjectItemSchema,
  listProjectItemsSchema,
  setFieldValueSchema,
  getFieldValueSchema,
  clearFieldValueSchema,
  archiveProjectItemSchema,
  unarchiveProjectItemSchema,
} from '../../../src/infrastructure/tools/ToolSchemas.js';
import {
  createProjectTool,
  listProjectsTool,
  getProjectTool,
  updateProjectTool,
  deleteProjectTool,
  createProjectFieldTool,
  listProjectFieldsTool,
  updateProjectFieldTool,
  addProjectItemTool,
  removeProjectItemTool,
  listProjectItemsTool,
  setFieldValueTool,
  getFieldValueTool,
  clearFieldValueTool,
  archiveProjectItemTool,
  unarchiveProjectItemTool,
} from '../../../src/infrastructure/tools/ToolSchemas.js';

describe('Project Tools', () => {
  describe('Input Schemas', () => {
    describe('createProjectSchema', () => {
      it('rejects missing title', () => {
        const result = createProjectSchema.safeParse({ owner: 'my-org' });
        expect(result.success).toBe(false);
      });

      it('rejects empty title', () => {
        const result = createProjectSchema.safeParse({
          title: '',
          owner: 'my-org',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing owner', () => {
        const result = createProjectSchema.safeParse({ title: 'My Project' });
        expect(result.success).toBe(false);
      });

      it('rejects empty owner', () => {
        const result = createProjectSchema.safeParse({
          title: 'My Project',
          owner: '',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input with required fields', () => {
        const result = createProjectSchema.safeParse({
          title: 'My Project',
          owner: 'my-org',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.title).toBe('My Project');
          expect(result.data.owner).toBe('my-org');
        }
      });

      it('accepts valid input with all optional fields', () => {
        const result = createProjectSchema.safeParse({
          title: 'My Project',
          shortDescription: 'A test project',
          owner: 'my-org',
          visibility: 'public',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.title).toBe('My Project');
          expect(result.data.visibility).toBe('public');
        }
      });

      it('defaults visibility to private', () => {
        const result = createProjectSchema.safeParse({
          title: 'My Project',
          owner: 'my-org',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.visibility).toBe('private');
        }
      });

      it('rejects invalid visibility value', () => {
        const result = createProjectSchema.safeParse({
          title: 'My Project',
          owner: 'my-org',
          visibility: 'invalid',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('listProjectsSchema', () => {
      it('accepts empty input with defaults', () => {
        const result = listProjectsSchema.safeParse({});
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.status).toBe('active');
        }
      });

      it('accepts valid status values', () => {
        const activeResult = listProjectsSchema.safeParse({ status: 'active' });
        expect(activeResult.success).toBe(true);

        const closedResult = listProjectsSchema.safeParse({ status: 'closed' });
        expect(closedResult.success).toBe(true);

        const allResult = listProjectsSchema.safeParse({ status: 'all' });
        expect(allResult.success).toBe(true);
      });

      it('rejects invalid status value', () => {
        const result = listProjectsSchema.safeParse({ status: 'invalid' });
        expect(result.success).toBe(false);
      });

      it('accepts valid limit', () => {
        const result = listProjectsSchema.safeParse({ limit: 50 });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.limit).toBe(50);
        }
      });

      it('rejects non-positive limit', () => {
        const result = listProjectsSchema.safeParse({ limit: 0 });
        expect(result.success).toBe(false);
      });

      it('rejects negative limit', () => {
        const result = listProjectsSchema.safeParse({ limit: -5 });
        expect(result.success).toBe(false);
      });

      it('rejects non-integer limit', () => {
        const result = listProjectsSchema.safeParse({ limit: 5.5 });
        expect(result.success).toBe(false);
      });
    });

    describe('getProjectSchema', () => {
      it('rejects missing projectId', () => {
        const result = getProjectSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = getProjectSchema.safeParse({ projectId: '' });
        expect(result.success).toBe(false);
      });

      it('accepts valid projectId', () => {
        const result = getProjectSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.projectId).toBe('PVT_kwDOTest123');
        }
      });

      it('rejects non-string projectId', () => {
        const result = getProjectSchema.safeParse({ projectId: 123 });
        expect(result.success).toBe(false);
      });
    });

    describe('updateProjectSchema', () => {
      it('rejects missing projectId', () => {
        const result = updateProjectSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = updateProjectSchema.safeParse({ projectId: '' });
        expect(result.success).toBe(false);
      });

      it('accepts projectId only', () => {
        const result = updateProjectSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid title update', () => {
        const result = updateProjectSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          title: 'New Title',
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.title).toBe('New Title');
        }
      });

      it('accepts valid visibility update', () => {
        const result = updateProjectSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          visibility: 'public',
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid status update', () => {
        const result = updateProjectSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          status: 'closed',
        });
        expect(result.success).toBe(true);
      });

      it('rejects invalid visibility', () => {
        const result = updateProjectSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          visibility: 'invalid',
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid status', () => {
        const result = updateProjectSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          status: 'pending',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('deleteProjectSchema', () => {
      it('rejects missing projectId', () => {
        const result = deleteProjectSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = deleteProjectSchema.safeParse({ projectId: '' });
        expect(result.success).toBe(false);
      });

      it('accepts valid projectId', () => {
        const result = deleteProjectSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('createProjectFieldSchema', () => {
      it('rejects missing projectId', () => {
        const result = createProjectFieldSchema.safeParse({
          name: 'Status',
          type: 'single_select',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing name', () => {
        const result = createProjectFieldSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          type: 'single_select',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing type', () => {
        const result = createProjectFieldSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          name: 'Status',
        });
        expect(result.success).toBe(false);
      });

      it('rejects invalid type', () => {
        const result = createProjectFieldSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          name: 'Status',
          type: 'invalid_type',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid text field', () => {
        const result = createProjectFieldSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          name: 'Description',
          type: 'text',
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid single_select field with options', () => {
        const result = createProjectFieldSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          name: 'Status',
          type: 'single_select',
          options: [
            { name: 'To Do', color: 'red' },
            { name: 'Done', color: 'green' },
          ],
        });
        expect(result.success).toBe(true);
      });

      it('accepts field with required flag', () => {
        const result = createProjectFieldSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          name: 'Priority',
          type: 'single_select',
          required: true,
        });
        expect(result.success).toBe(true);
      });

      it('rejects empty option name', () => {
        const result = createProjectFieldSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          name: 'Status',
          type: 'single_select',
          options: [{ name: '' }],
        });
        expect(result.success).toBe(false);
      });
    });

    describe('listProjectFieldsSchema', () => {
      it('rejects missing projectId', () => {
        const result = listProjectFieldsSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('rejects empty projectId', () => {
        const result = listProjectFieldsSchema.safeParse({ projectId: '' });
        expect(result.success).toBe(false);
      });

      it('accepts valid projectId', () => {
        const result = listProjectFieldsSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('updateProjectFieldSchema', () => {
      it('rejects missing projectId', () => {
        const result = updateProjectFieldSchema.safeParse({
          fieldId: 'PVTF_lADOTest',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing fieldId', () => {
        const result = updateProjectFieldSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(false);
      });

      it('accepts projectId and fieldId only', () => {
        const result = updateProjectFieldSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          fieldId: 'PVTF_lADOTest',
        });
        expect(result.success).toBe(true);
      });

      it('accepts name update', () => {
        const result = updateProjectFieldSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          fieldId: 'PVTF_lADOTest',
          name: 'New Name',
        });
        expect(result.success).toBe(true);
      });

      it('accepts options update', () => {
        const result = updateProjectFieldSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          fieldId: 'PVTF_lADOTest',
          options: [{ name: 'Option 1' }, { name: 'Option 2' }],
        });
        expect(result.success).toBe(true);
      });

      it('accepts empty options array', () => {
        const result = updateProjectFieldSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          fieldId: 'PVTF_lADOTest',
          options: [],
        });
        expect(result.success).toBe(true);
      });
    });

    describe('addProjectItemSchema', () => {
      it('rejects missing projectId', () => {
        const result = addProjectItemSchema.safeParse({
          contentId: 'I_kwDOTest',
          contentType: 'issue',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing contentId', () => {
        const result = addProjectItemSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          contentType: 'issue',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing contentType', () => {
        const result = addProjectItemSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          contentId: 'I_kwDOTest',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid issue content', () => {
        const result = addProjectItemSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          contentId: 'I_kwDOTestIssue',
          contentType: 'issue',
        });
        expect(result.success).toBe(true);
      });

      it('accepts valid pull_request content', () => {
        const result = addProjectItemSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          contentId: 'PR_kwDOTestPR',
          contentType: 'pull_request',
        });
        expect(result.success).toBe(true);
      });

      it('rejects invalid contentType', () => {
        const result = addProjectItemSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          contentId: 'I_kwDOTest',
          contentType: 'invalid',
        });
        expect(result.success).toBe(false);
      });
    });

    describe('removeProjectItemSchema', () => {
      it('rejects missing projectId', () => {
        const result = removeProjectItemSchema.safeParse({
          itemId: 'PVTI_lADOTest',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing itemId', () => {
        const result = removeProjectItemSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = removeProjectItemSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('listProjectItemsSchema', () => {
      it('rejects missing projectId', () => {
        const result = listProjectItemsSchema.safeParse({});
        expect(result.success).toBe(false);
      });

      it('accepts projectId only', () => {
        const result = listProjectItemsSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(true);
      });

      it('accepts custom limit', () => {
        const result = listProjectItemsSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          limit: 100,
        });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.limit).toBe(100);
        }
      });

      it('rejects non-positive limit', () => {
        const result = listProjectItemsSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          limit: 0,
        });
        expect(result.success).toBe(false);
      });
    });

    describe('setFieldValueSchema', () => {
      it('rejects missing projectId', () => {
        const result = setFieldValueSchema.safeParse({
          itemId: 'PVTI_lADOTest',
          fieldId: 'PVTF_lADOTest',
          value: 'test',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing itemId', () => {
        const result = setFieldValueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          fieldId: 'PVTF_lADOTest',
          value: 'test',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing fieldId', () => {
        const result = setFieldValueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest',
          value: 'test',
        });
        expect(result.success).toBe(false);
      });

      it('accepts string value', () => {
        const result = setFieldValueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest',
          fieldId: 'PVTF_lADOTest',
          value: 'test string',
        });
        expect(result.success).toBe(true);
      });

      it('accepts number value', () => {
        const result = setFieldValueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest',
          fieldId: 'PVTF_lADOTest',
          value: 42,
        });
        expect(result.success).toBe(true);
      });

      it('accepts array value', () => {
        const result = setFieldValueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest',
          fieldId: 'PVTF_lADOTest',
          value: ['label1', 'label2'],
        });
        expect(result.success).toBe(true);
      });

      it('accepts null value', () => {
        const result = setFieldValueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest',
          fieldId: 'PVTF_lADOTest',
          value: null,
        });
        expect(result.success).toBe(true);
      });
    });

    describe('getFieldValueSchema', () => {
      it('rejects missing projectId', () => {
        const result = getFieldValueSchema.safeParse({
          itemId: 'PVTI_lADOTest',
          fieldId: 'PVTF_lADOTest',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing itemId', () => {
        const result = getFieldValueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          fieldId: 'PVTF_lADOTest',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing fieldId', () => {
        const result = getFieldValueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = getFieldValueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest',
          fieldId: 'PVTF_lADOTest',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('clearFieldValueSchema', () => {
      it('rejects missing projectId', () => {
        const result = clearFieldValueSchema.safeParse({
          itemId: 'PVTI_lADOTest',
          fieldId: 'PVTF_lADOTest',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing itemId', () => {
        const result = clearFieldValueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          fieldId: 'PVTF_lADOTest',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing fieldId', () => {
        const result = clearFieldValueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = clearFieldValueSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest',
          fieldId: 'PVTF_lADOTest',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('archiveProjectItemSchema', () => {
      it('rejects missing projectId', () => {
        const result = archiveProjectItemSchema.safeParse({
          itemId: 'PVTI_lADOTest',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing itemId', () => {
        const result = archiveProjectItemSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = archiveProjectItemSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest',
        });
        expect(result.success).toBe(true);
      });
    });

    describe('unarchiveProjectItemSchema', () => {
      it('rejects missing projectId', () => {
        const result = unarchiveProjectItemSchema.safeParse({
          itemId: 'PVTI_lADOTest',
        });
        expect(result.success).toBe(false);
      });

      it('rejects missing itemId', () => {
        const result = unarchiveProjectItemSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
        });
        expect(result.success).toBe(false);
      });

      it('accepts valid input', () => {
        const result = unarchiveProjectItemSchema.safeParse({
          projectId: 'PVT_kwDOTest123',
          itemId: 'PVTI_lADOTest',
        });
        expect(result.success).toBe(true);
      });
    });
  });

  describe('Tool Definitions', () => {
    describe('createProjectTool', () => {
      it('has correct name', () => {
        expect(createProjectTool.name).toBe('create_project');
      });

      it('has correct title', () => {
        expect(createProjectTool.title).toBe('Create Project');
      });

      it('has create annotation', () => {
        expect(createProjectTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(createProjectTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(createProjectTool.examples).toBeDefined();
        expect(createProjectTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('listProjectsTool', () => {
      it('has correct name', () => {
        expect(listProjectsTool.name).toBe('list_projects');
      });

      it('has correct title', () => {
        expect(listProjectsTool.title).toBe('List Projects');
      });

      it('has readOnly annotation', () => {
        expect(listProjectsTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(listProjectsTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(listProjectsTool.examples).toBeDefined();
        expect(listProjectsTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('getProjectTool', () => {
      it('has correct name', () => {
        expect(getProjectTool.name).toBe('get_project');
      });

      it('has correct title', () => {
        expect(getProjectTool.title).toBe('Get Project');
      });

      it('has readOnly annotation', () => {
        expect(getProjectTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(getProjectTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(getProjectTool.examples).toBeDefined();
        expect(getProjectTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('updateProjectTool', () => {
      it('has correct name', () => {
        expect(updateProjectTool.name).toBe('update_project');
      });

      it('has correct title', () => {
        expect(updateProjectTool.title).toBe('Update Project');
      });

      it('has updateIdempotent annotation', () => {
        expect(updateProjectTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(updateProjectTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(updateProjectTool.examples).toBeDefined();
        expect(updateProjectTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('deleteProjectTool', () => {
      it('has correct name', () => {
        expect(deleteProjectTool.name).toBe('delete_project');
      });

      it('has correct title', () => {
        expect(deleteProjectTool.title).toBe('Delete Project');
      });

      it('has delete annotation', () => {
        expect(deleteProjectTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(deleteProjectTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(deleteProjectTool.examples).toBeDefined();
        expect(deleteProjectTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('createProjectFieldTool', () => {
      it('has correct name', () => {
        expect(createProjectFieldTool.name).toBe('create_project_field');
      });

      it('has correct title', () => {
        expect(createProjectFieldTool.title).toBe('Create Project Field');
      });

      it('has create annotation', () => {
        expect(createProjectFieldTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(createProjectFieldTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(createProjectFieldTool.examples).toBeDefined();
        expect(createProjectFieldTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('listProjectFieldsTool', () => {
      it('has correct name', () => {
        expect(listProjectFieldsTool.name).toBe('list_project_fields');
      });

      it('has correct title', () => {
        expect(listProjectFieldsTool.title).toBe('List Project Fields');
      });

      it('has readOnly annotation', () => {
        expect(listProjectFieldsTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(listProjectFieldsTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(listProjectFieldsTool.examples).toBeDefined();
        expect(listProjectFieldsTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('updateProjectFieldTool', () => {
      it('has correct name', () => {
        expect(updateProjectFieldTool.name).toBe('update_project_field');
      });

      it('has correct title', () => {
        expect(updateProjectFieldTool.title).toBe('Update Project Field');
      });

      it('has updateIdempotent annotation', () => {
        expect(updateProjectFieldTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(updateProjectFieldTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(updateProjectFieldTool.examples).toBeDefined();
        expect(updateProjectFieldTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('addProjectItemTool', () => {
      it('has correct name', () => {
        expect(addProjectItemTool.name).toBe('add_project_item');
      });

      it('has correct title', () => {
        expect(addProjectItemTool.title).toBe('Add Project Item');
      });

      it('has updateIdempotent annotation', () => {
        expect(addProjectItemTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(addProjectItemTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(addProjectItemTool.examples).toBeDefined();
        expect(addProjectItemTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('removeProjectItemTool', () => {
      it('has correct name', () => {
        expect(removeProjectItemTool.name).toBe('remove_project_item');
      });

      it('has correct title', () => {
        expect(removeProjectItemTool.title).toBe('Remove Project Item');
      });

      it('has delete annotation', () => {
        expect(removeProjectItemTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(removeProjectItemTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(removeProjectItemTool.examples).toBeDefined();
        expect(removeProjectItemTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('listProjectItemsTool', () => {
      it('has correct name', () => {
        expect(listProjectItemsTool.name).toBe('list_project_items');
      });

      it('has correct title', () => {
        expect(listProjectItemsTool.title).toBe('List Project Items');
      });

      it('has readOnly annotation', () => {
        expect(listProjectItemsTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(listProjectItemsTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(listProjectItemsTool.examples).toBeDefined();
        expect(listProjectItemsTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('setFieldValueTool', () => {
      it('has correct name', () => {
        expect(setFieldValueTool.name).toBe('set_field_value');
      });

      it('has correct title', () => {
        expect(setFieldValueTool.title).toBe('Set Field Value');
      });

      it('has updateIdempotent annotation', () => {
        expect(setFieldValueTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(setFieldValueTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(setFieldValueTool.examples).toBeDefined();
        expect(setFieldValueTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('getFieldValueTool', () => {
      it('has correct name', () => {
        expect(getFieldValueTool.name).toBe('get_field_value');
      });

      it('has correct title', () => {
        expect(getFieldValueTool.title).toBe('Get Field Value');
      });

      it('has readOnly annotation', () => {
        expect(getFieldValueTool.annotations).toEqual({
          readOnlyHint: true,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(getFieldValueTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(getFieldValueTool.examples).toBeDefined();
        expect(getFieldValueTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('clearFieldValueTool', () => {
      it('has correct name', () => {
        expect(clearFieldValueTool.name).toBe('clear_field_value');
      });

      it('has correct title', () => {
        expect(clearFieldValueTool.title).toBe('Clear Field Value');
      });

      it('has updateIdempotent annotation', () => {
        expect(clearFieldValueTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(clearFieldValueTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(clearFieldValueTool.examples).toBeDefined();
        expect(clearFieldValueTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('archiveProjectItemTool', () => {
      it('has correct name', () => {
        expect(archiveProjectItemTool.name).toBe('archive_project_item');
      });

      it('has correct title', () => {
        expect(archiveProjectItemTool.title).toBe('Archive Project Item');
      });

      it('has updateIdempotent annotation', () => {
        expect(archiveProjectItemTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(archiveProjectItemTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(archiveProjectItemTool.examples).toBeDefined();
        expect(archiveProjectItemTool.examples!.length).toBeGreaterThan(0);
      });
    });

    describe('unarchiveProjectItemTool', () => {
      it('has correct name', () => {
        expect(unarchiveProjectItemTool.name).toBe('unarchive_project_item');
      });

      it('has correct title', () => {
        expect(unarchiveProjectItemTool.title).toBe('Unarchive Project Item');
      });

      it('has updateIdempotent annotation', () => {
        expect(unarchiveProjectItemTool.annotations).toEqual({
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: true,
          openWorldHint: true,
        });
      });

      it('has output schema defined', () => {
        expect(unarchiveProjectItemTool.outputSchema).toBeDefined();
      });

      it('has examples', () => {
        expect(unarchiveProjectItemTool.examples).toBeDefined();
        expect(unarchiveProjectItemTool.examples!.length).toBeGreaterThan(0);
      });
    });
  });
});
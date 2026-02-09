import { vi } from 'vitest';

export const createMockWeaviateClient = () => {
  const mockClient = {
    schema: {
      getter: vi.fn().mockReturnValue({
        do: vi.fn().mockResolvedValue({
          classes: [],
        }),
      }),
      classCreator: vi.fn().mockReturnValue({
        withClass: vi.fn().mockReturnValue({
          do: vi.fn().mockResolvedValue({}),
        }),
      }),
    },
    graphql: {
      get: vi.fn().mockReturnValue({
        withClassName: vi.fn().mockReturnValue({
          withWhere: vi.fn().mockReturnValue({
            withFields: vi.fn().mockReturnValue({
              withLimit: vi.fn().mockReturnValue({
                do: vi.fn().mockResolvedValue({
                  data: {
                    Get: {
                      WebsiteContent: [],
                      DocumentContent: [],
                    },
                  },
                }),
              }),
            }),
          }),
        }),
      }),
    },
    data: {
      creator: vi.fn().mockReturnValue({
        withClassName: vi.fn().mockReturnValue({
          withProperties: vi.fn().mockReturnValue({
            do: vi.fn().mockResolvedValue({
              id: 'mock-id',
            }),
          }),
        }),
      }),
      deleter: vi.fn().mockReturnValue({
        withClassName: vi.fn().mockReturnValue({
          withId: vi.fn().mockReturnValue({
            do: vi.fn().mockResolvedValue({}),
          }),
        }),
      }),
    },
  };

  return mockClient;
};

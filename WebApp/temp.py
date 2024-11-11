def solve(arr):

    ans = 0
    for j in range(len(arr)):
        el = arr[j]
        hash_map = {}
        for i in range(len(arr)):
            if i == j:
                continue
            complement = 2*el - arr[i]
            if complement in hash_map:
                ans += 1
            hash_map[arr[i]] = i
    return ans

print(solve([1, 2, 3]))
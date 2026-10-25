#include <windows.h>
__declspec(dllexport) int __cdecl WeightedSum(int leftValue, int rightValue, int weight) {
    return leftValue * weight + rightValue * (100 - weight);
}
